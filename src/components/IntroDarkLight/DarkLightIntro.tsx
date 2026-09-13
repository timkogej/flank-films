"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { setPreviewPrewarm } from "@/components/ProjectCard/previewScheduler";

import {
  DARK_LIGHT_MODE,
  DARK_LIGHT_REDUCED,
  DARK_LIGHT_TOTAL_MS,
  INTRO_SCORE,
  introMarks,
  type IntroProfile,
  WORDMARK,
} from "./darkLightConfig";
import { DarkLightDevPanel } from "./DarkLightDevPanel";

import styles from "./DarkLightIntro.module.css";

const DEV = process.env.NODE_ENV !== "production";

/**
 * Whether this render is hydrating the server's HTML.
 *
 * `useSyncExternalStore` reads the SERVER snapshot on the server and while
 * hydrating, and the client snapshot on every other mount. A page wrapped in
 * this intro is hydrated exactly once per document — a fresh load, a new tab,
 * a refresh — and every other arrival at it (Home, About, the wordmark, Back
 * and Forward, closing a film, arriving from any directly-loaded page) is a
 * client render. So the question "is this the page the browser just loaded?" is
 * answered by React itself: no storage, no URL flag, no route listener, and
 * nothing that survives a reload to suppress the next one.
 */
/**
 * The score, as the custom properties the stylesheet animates with. Both
 * profiles are emitted and the stylesheet picks one per breakpoint, so the
 * numbers live only in darkLightConfig and the server's first paint already
 * carries them — no client measurement, nothing to hydrate into place.
 */
function scoreVars(prefix: string, p: IntroProfile) {
  const m = introMarks(p);
  return {
    [`--${prefix}-shine-delay`]: `${m.shineStart}ms`,
    [`--${prefix}-shine-duration`]: `${p.shineDuration}ms`,
    [`--${prefix}-rise-delay`]: `${m.riseStart}ms`,
    [`--${prefix}-rise-duration`]: `${p.riseDuration}ms`,
  };
}

const SCORE_STYLE = {
  ...scoreVars("desktop", INTRO_SCORE.desktop),
  ...scoreVars("phone", INTRO_SCORE.phone),
  "--reduced-hold": `${DARK_LIGHT_REDUCED.hold}ms`,
  "--reduced-fade": `${DARK_LIGHT_REDUCED.fade}ms`,
} as React.CSSProperties;

const noSubscription = () => () => {};
const onClient = () => false;
const onServerOrHydrating = () => true;

/**
 * The DARK LIGHT intro.
 *
 * Structure — the same three-part shape the production intro proved, because
 * that part of it was never the problem:
 *
 *   .stage    one viewport, clipping, while the sequence runs
 *     .curtain  fixed graphite field holding the wordmark
 *     .riser    the REAL homepage, parked one viewport down and animated
 *               back to 0, occluding the curtain as it arrives
 *
 * `children` is the actual page — the homepage or About, with its own shell,
 * its own header and its own content, mounted and laid out from the first
 * frame. Nothing is duplicated,
 * reconstructed or faked, and the thing that covers the intro is the page
 * itself rather than a white rectangle that gets swapped for one.
 *
 * The wordmark is a black object, not a reveal. It is at full size and full
 * contrast in the first painted frame and it never moves, scales or fades —
 * the only thing that travels is the reflection. See the stylesheet for the
 * four layers that make it a surface rather than a silhouette.
 *
 * There is one configuration and the stylesheet contains only it — material
 * A, shine B, the polish luminance profile, the flat BG 1 ground. Nothing
 * here selects between variants, so production cannot drift onto the wrong
 * one and does not depend on the default state of a dev control.
 *
 * The sequence is entirely declarative CSS, server-rendered in its opening
 * state, so the first paint the browser makes is already the finished frame.
 * React is used for three things only — to know the sequence is over, to hand
 * the previews back to the ordinary rules, and (in development only) to drive
 * the dev panel. Nothing here runs per frame.
 */
export function DarkLightIntro({
  children,
  controls = false,
}: {
  children: React.ReactNode;
  /** Show the development replay/speed panel. The isolated test route passes
   *  this; the homepage never does, so the panel cannot appear on `/` even in
   *  a development build. */
  controls?: boolean;
}) {
  const hydrating = useSyncExternalStore(
    noSubscription,
    onClient,
    onServerOrHydrating,
  );
  /**
   * Decided once, in the first render. The server renders the curtain, so a
   * document load hydrates onto it and plays; a client-side mount starts in
   * the finished state and the curtain is never rendered at all — not even
   * for one frame. `hydrating` turning false a moment after hydration does
   * not reach this: state keeps its initial value.
   */
  const [entrance] = useState(
    () => DARK_LIGHT_MODE === "every-load" && hydrating,
  );
  const [running, setRunning] = useState(entrance);
  /** Bumped by Replay. Restarts the CSS animations by remounting the curtain
   *  and re-applying `.running` — never by remounting `children`, which would
   *  throw away the homepage's media and defeat the point of the prototype. */
  const [run, setRun] = useState(0);

  const [rate, setRate] = useState(1);
  const [paused, setPaused] = useState(false);

  const stage = useRef<HTMLDivElement>(null);
  const riser = useRef<HTMLDivElement>(null);

  /**
   * Instance-unique ids for the edge clip and the edge gradient. Two intros on
   * one page cannot collide, and neither can this prototype and any other SVG
   * on the homepage underneath it.
   */
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  const ID = { glyphs: `${uid}-glyphs`, edge: `${uid}-edge` };

  /* -------------------------------------------------------------- prewarm */

  // The homepage is mounted and laid out from the first frame, so its autoplay
  // previews may load and start now — this reuses the production scheduler's
  // existing prewarm window rather than duplicating any of its logic. The
  // media never delays the intro and the intro never waits for the media.
  // Without an entrance the cards are already on screen: nothing to prewarm.
  useEffect(() => {
    if (!entrance) return;
    setPreviewPrewarm(true);
    return () => setPreviewPrewarm(false);
  }, [entrance]);

  useEffect(() => {
    if (running) return;

    // Hand back to the ordinary rules two frames late, on purpose. The riser's
    // transform clears in the same commit that ends the sequence, and the
    // observer only reports the new positions after the next paint. Releasing
    // in between would briefly see every card as off screen and pause the very
    // previews that are now on the page.
    const frames: number[] = [];
    frames.push(
      requestAnimationFrame(() => {
        frames.push(requestAnimationFrame(() => setPreviewPrewarm(false)));
      }),
    );
    return () => frames.forEach(cancelAnimationFrame);
  }, [running]);

  /* ------------------------------------------------------------- lifecycle */

  /**
   * End the sequence when the page has actually arrived, not when a stopwatch
   * says it should have.
   *
   * The riser's own animation is the authority, which means pausing it or
   * running it at 0.5x in the dev panel cannot desynchronise the overlay from
   * the page — there is no second clock to keep in step. The timeout is only
   * the fallback for reduced motion (where nothing animates) and for an engine
   * that reports no animations at all.
   */
  useEffect(() => {
    if (!running) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const animations =
      !reduced && riser.current
        ? riser.current.getAnimations().filter((a) => a.playState !== "idle")
        : [];

    if (animations.length === 0) {
      const id = window.setTimeout(
        () => setRunning(false),
        reduced
          ? DARK_LIGHT_REDUCED.hold + DARK_LIGHT_REDUCED.fade
          : DARK_LIGHT_TOTAL_MS,
      );
      return () => window.clearTimeout(id);
    }

    let live = true;
    Promise.all(animations.map((a) => a.finished))
      .then(() => {
        if (live) setRunning(false);
      })
      // Rejects with AbortError when an animation is cancelled — which is what
      // Replay does on purpose.
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [running, run]);

  /**
   * Development guard for the official geometry.
   *
   * The silhouette is cut from the asset (as a CSS mask) and the edge
   * highlight is stroked from the transcribed paths, so two copies of the same
   * geometry exist and must agree exactly. This shouts if they ever stop
   * agreeing. Never runs in a production build.
   */
  useEffect(() => {
    if (!DEV) return;
    let cancelled = false;
    fetch(WORDMARK.source)
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return;
        const ds = [...text.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1].trim());
        const mine = WORDMARK.paths.map((p) => p.d.trim());
        if (ds.length !== mine.length || ds.some((d, i) => d !== mine[i])) {
          console.warn(
            "[DarkLightIntro] embedded wordmark geometry differs from",
            WORDMARK.source,
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /* ----------------------------------------------------------- dev controls */

  // Speed and pause are applied to the real animations rather than to a
  // parallel clock, for the same reason as above: there is only ever one
  // timeline. Never runs in a production build.
  useEffect(() => {
    if (!DEV || !controls || !running) return;
    const el = stage.current;
    if (!el) return;
    for (const a of el.getAnimations({ subtree: true })) {
      a.playbackRate = rate;
      if (paused) a.pause();
      else if (a.playState === "paused") a.play();
    }
  }, [rate, paused, running, run, controls]);

  const replay = useCallback(() => {
    setPaused(false);
    setRunning(false);
    // One frame down, so `.running` and the curtain are genuinely gone before
    // they come back — otherwise the animations are never re-created and
    // nothing replays.
    requestAnimationFrame(() => {
      setRun((n) => n + 1);
      setRunning(true);
    });
  }, []);

  /* ---------------------------------------------------------------- render */

  return (
    <div
      ref={stage}
      className={running ? `${styles.stage} ${styles.running}` : styles.stage}
      style={SCORE_STYLE}
    >
      {running && (
        <div key={run} className={styles.curtain} aria-hidden="true">
          <div className={styles.stack}>
            {/* Layers 1, 2 and 4, all cut by one mask from the official asset.
                Nothing lit exists outside it, which is why no glow is
                possible and the graphite field stays untouched. */}
            <div className={styles.mark}>
              <div className={styles.base} />
              <div className={styles.face} />
              <div className={styles.shine} />
            </div>

            {/* Layer 3: the inner edge. The path is stroked and then clipped
                by its own geometry, so the outer half of the stroke is
                discarded — the official outline stays exact to the pixel and
                the highlight can only ever live inside it. */}
            <svg
              className={styles.edges}
              viewBox={`0 0 ${WORDMARK.viewBox.w} ${WORDMARK.viewBox.h}`}
              focusable="false"
            >
              <defs>
                <clipPath id={ID.glyphs} clipPathUnits="userSpaceOnUse">
                  {WORDMARK.paths.map((p) => (
                    <path
                      key={p.d}
                      d={p.d}
                      clipRule={p.evenOdd ? "evenodd" : undefined}
                    />
                  ))}
                </clipPath>
                {/* Purely vertical, and that is the point: the wordmark is
                    1499 units wide and 226 tall, so any horizontal component
                    in this axis is dominated by x — the F's lower-left corner
                    lights up while the K gets nothing. A vertical axis is also
                    the honest description of the scene: one long strip light
                    above a wide object, so every letter is treated the same
                    way and only height decides what catches. */}
                <linearGradient
                  id={ID.edge}
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  y1="-34"
                  x2="0"
                  y2="250"
                >
                  <stop offset="0" className={styles.edgeTop} />
                  <stop offset="0.42" className={styles.edgeMid} />
                  <stop offset="0.78" className={styles.edgeLow} />
                </linearGradient>
              </defs>
              <g clipPath={`url(#${ID.glyphs})`}>
                {WORDMARK.paths.map((p) => (
                  <path
                    key={p.d}
                    d={p.d}
                    className={styles.edgeStroke}
                    stroke={`url(#${ID.edge})`}
                  />
                ))}
              </g>
            </svg>
          </div>
        </div>
      )}
      <div ref={riser} className={styles.riser}>
        {children}
      </div>

      {DEV && controls && (
        <DarkLightDevPanel
          rate={rate}
          paused={paused}
          onRate={setRate}
          onPause={() => setPaused((p) => !p)}
          onReplay={replay}
        />
      )}
    </div>
  );
}
