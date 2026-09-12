"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  INTRO_V2_DEV_REPLAY_PAUSE,
  INTRO_V2_GRADE,
  INTRO_V2_QA_RATES,
  INTRO_V2_SCORE,
  INTRO_V2_SHOTS,
  INTRO_V2_STEP1_GRADE,
  INTRO_V2_STEP1_REFERENCE,
  type IntroV2Mode,
} from "./introV2Config";

import styles from "./FlankIntroV2Prototype.module.css";

/**
 * FLANK intro V2 — PROTOTYPE. Step 2: the choreography.
 *
 * The production intro is untouched and still owns the homepage — today that
 * is `IntroDarkLight`, not the `FlankIntro` this was written beside. This had
 * one route, /intro-v2-test, removed before the first deploy; it is now
 * unreachable source. It stops where Step 3 begins: black, a white
 * FLANK, film entering the mark, Pingo, cut, OTP, cut, Bohinj — and then it
 * simply keeps running.
 *
 * ONE CLOCK.
 *
 * Everything the sequence does is a pure function of milliseconds since it
 * started, evaluated in a single rAF loop: the white mark's opacity, the
 * position of the travelling exposure, and which of the three clips is on
 * screen. That is not tidiness for its own sake — it is what makes a cut land
 * on the frame it is supposed to. `setTimeout` per cut drifts by however long
 * the main thread was busy, and a 400ms shot cannot absorb that. It is also
 * what makes 0.5x QA exact rather than approximate: the rate divides elapsed
 * time, and every value downstream follows for free, with the score in
 * introV2Config.ts left untouched.
 *
 * The loop writes CSS custom properties and one data attribute straight to the
 * DOM. React renders the elements and never re-renders during the sequence.
 *
 * THREE STACKED VIDEOS, ONE MASK.
 *
 * The mask is on the container, not on each clip, so there is exactly one
 * masked element in the tree with three plain <video> children inside it. Three
 * separately masked, separately composited video layers is the arrangement most
 * likely to fall over in Safari; this is the boring one. The cut itself is an
 * opacity swap with no transition — the FLANK silhouette is identical on both
 * sides of it, so what the eye sees is the image changing, not the shape.
 *
 * Only the active clip is playing. The other two are decoded, seeked to their
 * first frame and paused, so nothing off screen keeps a decoder busy.
 */
export function FlankIntroV2Prototype() {
  const [mode, setMode] = useState<IntroV2Mode>("step2");
  const [rate, setRate] = useState<number>(1);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  /** Bumped by Replay and by the dev auto-replay. Remounts the sequence. */
  const [run, setRun] = useState(0);

  const motionOk = useMotionAllowed();
  const replay = useCallback(() => setRun((value) => value + 1), []);

  // H hides the panel so it cannot influence a judgement about the mark.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "h" || event.key === "H") {
        setShowControls((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={styles.stage}>
      {mode === "step2" ? (
        <Sequence
          key={`step2-${run}`}
          motionOk={motionOk}
          rate={rate}
          paused={paused}
          onEnded={replay}
        />
      ) : (
        <Step1Reference key={`step1-${run}`} motionOk={motionOk} />
      )}

      {showControls && (
        <div className={styles.controls}>
          <span className={styles.controlsLabel}>intro v2 · step 2</span>
          <div className={styles.controlsRow}>
            <button
              type="button"
              onClick={() => setMode("step2")}
              data-active={mode === "step2"}
            >
              sequence
            </button>
            <button
              type="button"
              onClick={() => setMode("step1")}
              data-active={mode === "step1"}
            >
              step 1 ref
            </button>
          </div>
          {mode === "step2" && (
            <div className={styles.controlsRow}>
              <button type="button" onClick={replay}>
                replay
              </button>
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                data-active={paused}
              >
                {paused ? "play" : "pause"}
              </button>
              {INTRO_V2_QA_RATES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRate(value)}
                  data-active={rate === value}
                >
                  {value}×
                </button>
              ))}
            </div>
          )}
          <span className={styles.controlsNote}>
            {!motionOk
              ? "reduced motion — static mark"
              : "auto-replay is DEV only"}
          </span>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type ShotId = (typeof INTRO_V2_SHOTS)[number]["id"];

/**
 * Where the sequence is at time `t`, in ms.
 *
 * The whole score, evaluated. Nothing else in this file decides timing.
 */
function frameAt(t: number) {
  const s = INTRO_V2_SCORE;

  // The white mark: a plain opacity ramp. No scale, no blur, no bounce (§4).
  const white = clamp01((t - s.whiteIn) / s.whiteInDuration);

  // The travelling exposure, 0 -> 1 across the mark. Runs once, at the start,
  // and only for the white -> Pingo conversion (§20).
  const reveal = clamp01((t - s.revealStart) / s.revealDuration);

  // Which clip is on screen. Before the reveal begins there is no film at all,
  // which is what keeps the opening a clean white beat rather than a fade
  // between two images.
  let shot: ShotId | null = null;
  if (t >= s.bohinjCut) shot = "bohinj";
  else if (t >= s.otpCut) shot = "otp";
  else if (t >= s.revealStart) shot = "pingo";

  return { white, reveal, shot };
}

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * One run of the choreography.
 *
 * Mounted fresh for every replay, so there is no state to rewind and the clock
 * always starts from zero.
 */
function Sequence({
  motionOk,
  rate,
  paused,
  onEnded,
}: {
  motionOk: boolean;
  rate: number;
  paused: boolean;
  onEnded: () => void;
}) {
  const markRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  /** Real frames are decodable for all three clips (§24). */
  const [armed, setArmed] = useState(false);

  // Live values the rAF loop reads without having to restart itself. Mirrored
  // into refs rather than listed as effect dependencies, because tearing the
  // loop down and rebuilding it mid-sequence would reset the clock — and
  // changing speed is exactly the moment you least want that to happen.
  const rateRef = useRef(rate);
  const pausedRef = useRef(paused);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  /**
   * Readiness. The sequence does not start until every clip can paint a frame,
   * because a cut that lands on an undecoded video shows an empty letterform —
   * the one failure this whole design exists to avoid. The three assets total
   * ~330KB, so in practice this resolves almost immediately; the timeout is
   * insurance, not a strategy.
   */
  useEffect(() => {
    if (!motionOk) return;
    const root = mediaRef.current;
    if (!root) return;

    const videos = Array.from(root.querySelectorAll("video"));
    if (videos.length === 0) return;

    let disposed = false;
    const pending = new Set(videos);
    const settle = () => {
      if (!disposed && pending.size === 0) setArmed(true);
    };
    const onReady = (event: Event) => {
      pending.delete(event.currentTarget as HTMLVideoElement);
      settle();
    };

    videos.forEach((video) => {
      if (video.readyState >= 2) pending.delete(video);
      else video.addEventListener("loadeddata", onReady, { once: true });
    });

    const frame = requestAnimationFrame(settle);
    const fallback = window.setTimeout(() => {
      if (!disposed) setArmed(true);
    }, 2000);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
      videos.forEach((v) => v.removeEventListener("loadeddata", onReady));
    };
  }, [motionOk]);

  /**
   * The clock.
   *
   * One loop, started once the media is armed, writing three values per frame.
   * It owns playback too: the clip whose beat it is plays, the other two stay
   * paused at their first frame.
   */
  useEffect(() => {
    if (!motionOk || !armed) return;
    const mark = markRef.current;
    const root = mediaRef.current;
    if (!mark || !root) return;

    const videos = new Map<string, HTMLVideoElement>();
    root.querySelectorAll<HTMLVideoElement>("video[data-shot]").forEach((v) => {
      videos.set(v.dataset.shot!, v);
    });

    let elapsed = 0;
    let last = performance.now();
    let current: ShotId | null | undefined;
    let ended = false;
    let raf = 0;
    let replayTimer = 0;

    const activate = (next: ShotId | null) => {
      if (next === current) return;
      current = next;
      videos.forEach((video, id) => {
        if (id === next) {
          video.playbackRate = rateRef.current;
          const started = video.play();
          // Muted and inline, so this normally resolves. A refusal leaves the
          // clip on its first frame, which is a real frame from the same film.
          if (started) started.catch(() => {});
        } else if (!video.paused) {
          video.pause();
          video.currentTime = 0;
        }
      });
      mark.dataset.shot = next ?? "none";
    };

    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      if (!pausedRef.current) elapsed += delta * rateRef.current;

      const { white, reveal, shot } = frameAt(elapsed);
      mark.style.setProperty("--white-o", white.toFixed(4));
      mark.style.setProperty("--reveal-p", `${(1 - reveal) * 100}%`);
      activate(shot);

      const active = shot ? videos.get(shot) : undefined;
      if (active) {
        if (pausedRef.current && !active.paused) active.pause();
        // `ended` is deliberately excluded: calling play() on a finished clip
        // rewinds it to frame 0, which inside the mark reads as an unplanned
        // cut. If a clip ever does run out it holds on its last frame instead.
        // The replay pause is set so this cannot happen in the normal run.
        else if (!pausedRef.current && active.paused && !active.ended) {
          const started = active.play();
          if (started) started.catch(() => {});
        }
        if (active.playbackRate !== rateRef.current) {
          active.playbackRate = rateRef.current;
        }
      }

      // The choreography is over, but the picture is not: Bohinj keeps running
      // and the prototype simply sits on it. The replay below is DEV scaffolding
      // so the sequence can be watched on a loop — Step 3 replaces this ending.
      if (!ended && elapsed >= INTRO_V2_SCORE.end) {
        ended = true;
        replayTimer = window.setTimeout(
          onEnded,
          INTRO_V2_DEV_REPLAY_PAUSE / rateRef.current,
        );
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(replayTimer);
      videos.forEach((v) => v.pause());
    };
  }, [motionOk, armed, onEnded]);

  return (
    <div className={styles.mark} ref={markRef} data-shot="none">
      {/* The opening state, and the only thing a reduced-motion visitor sees. */}
      <div className={styles.white} aria-hidden="true" />

      {/* One masked container. The three clips are plain children of it. */}
      <div className={styles.media} ref={mediaRef} aria-hidden="true">
        <div className={styles.reveal}>
          <div className={styles.field}>
            {motionOk &&
              INTRO_V2_SHOTS.map((shot) => (
                <video
                  key={shot.id}
                  data-shot={shot.id}
                  className={styles.frame}
                  style={
                    {
                      "--crop": shot.crop.position,
                      "--crop-m": shot.crop.mobilePosition,
                      "--scale": shot.crop.scale,
                      "--scale-m": shot.crop.mobileScale,
                      "--grade": shot.grade ?? INTRO_V2_GRADE,
                    } as React.CSSProperties
                  }
                  src={shot.src}
                  muted
                  playsInline
                  preload="auto"
                  tabIndex={-1}
                  aria-hidden="true"
                  disablePictureInPicture
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Step 1's single-field result, for side-by-side comparison only.
 *
 * The same mark filled with an unmodified homepage preview, revealed once and
 * then left to loop. No cuts, no score — this is the thing Step 2 is measured
 * against, not part of it.
 */
function Step1Reference({ motionOk }: { motionOk: boolean }) {
  const markRef = useRef<HTMLDivElement>(null);
  const clip = INTRO_V2_STEP1_REFERENCE;

  useEffect(() => {
    if (!motionOk) return;
    const mark = markRef.current;
    if (!mark) return;
    const video = mark.querySelector("video");
    if (video) {
      const started = video.play();
      if (started) started.catch(() => {});
    }
    mark.style.setProperty("--white-o", "1");
    const id = window.setTimeout(() => {
      mark.style.setProperty("--reveal-p", "0%");
    }, INTRO_V2_SCORE.revealStart);
    return () => {
      window.clearTimeout(id);
      video?.pause();
    };
  }, [motionOk]);

  return (
    <div
      className={`${styles.mark} ${styles.step1}`}
      ref={markRef}
      data-shot="step1"
    >
      <div className={styles.white} aria-hidden="true" />
      <div className={styles.media} aria-hidden="true">
        <div className={styles.reveal}>
          <div className={styles.field}>
            {motionOk && clip && (
              <video
                data-shot="step1"
                className={styles.frame}
                style={
                  {
                    "--crop": clip.crop.position,
                    "--crop-m": clip.crop.mobilePosition,
                    "--scale": clip.crop.scale,
                    "--scale-m": clip.crop.mobileScale,
                    "--grade": INTRO_V2_STEP1_GRADE,
                  } as React.CSSProperties
                }
                src={clip.src}
                poster={clip.poster}
                muted
                loop
                playsInline
                preload="auto"
                tabIndex={-1}
                aria-hidden="true"
                disablePictureInPicture
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Motion preference, as an external store.
 *
 * The server cannot know the preference, so the server snapshot is the
 * conservative one: motion NOT allowed. First paint and the hydration that
 * matches it are therefore the reduced-motion state — black, white wordmark, no
 * <video> in the tree at all — and a visitor who does not allow motion never
 * downloads a byte of the intro clips.
 */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotion(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function motionSnapshot() {
  if (typeof window.matchMedia !== "function") return true;
  return !window.matchMedia(REDUCED_MOTION).matches;
}

function useMotionAllowed() {
  return useSyncExternalStore(subscribeToMotion, motionSnapshot, () => false);
}
