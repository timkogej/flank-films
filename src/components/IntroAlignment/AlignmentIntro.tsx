"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { setPreviewPrewarm } from "@/components/ProjectCard/previewScheduler";

import {
  ALIGNMENT_REDUCED,
  ALIGNMENT_SCORE,
  ALIGNMENT_TOTAL_MS,
  DEFAULT_STUDY,
  resolveStudy,
  STUDIES,
  WORDMARK,
  type StudyId,
} from "./alignmentConfig";
import {
  bandPath,
  PLATE_RECT,
  plateLength,
  readAnchors,
  rightOfPath,
  solveSweep,
  type Anchors,
} from "./alignmentGeometry";
import { AlignmentDevPanel } from "./AlignmentDevPanel";

import styles from "./AlignmentIntro.module.css";

const DEV = process.env.NODE_ENV !== "production";
const SVG_NS = "http://www.w3.org/2000/svg";

/** The whole plane. The server-rendered default, so the first paint is black. */
const FULL_PLANE = `M ${PLATE_RECT.x} ${PLATE_RECT.y} h ${PLATE_RECT.w} v ${PLATE_RECT.h} h ${-PLATE_RECT.w} Z`;

/**
 * The ALIGNMENT LOCK prototype.
 *
 * `children` is the REAL homepage — mounted, laid out and prewarming from the
 * first frame. Nothing about it is duplicated, reconstructed or screenshotted;
 * this component only draws over it and then removes itself.
 *
 * Everything visible is three shapes in one fixed SVG, inside one reveal clip:
 *
 *   void     black, full frame            the ground the piece opens on
 *   slab     white, one leaning band, sweeping on one axis
 *   plate    black, one leaning band, sweeping on the other, with the
 *            wordmark cut out of it
 *
 * The aperture never moves. It is nothing on its own — a hole in black over
 * black — and the slab is a plain rectangle with no letterform in it. The mark
 * exists only where the two planes and that one place coincide.
 *
 * So the white plane lays its ground behind the mark, the black plane sweeps
 * across, and the wordmark is written into the black in its wake — bounded at
 * every instant by the plane's own leading edge, which is why no frame of this
 * can read as a broken logo. When the plane holds the frame the mark stands
 * alone; when its back edge passes, the white returns and takes it.
 *
 * The DOM is written imperatively from one `draw(t)`. React owns what exists,
 * never what any frame looks like, so nothing here re-renders while it runs.
 */
export function AlignmentIntro({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);

  /**
   * Instance-unique ids for the mask and the reveal clip.
   *
   * The overlay is never unmounted while the page lives — it is hidden. That
   * is not tidiness: tearing down an <svg> that owns `mask`/`clipPath`
   * resources and building an identical one leaves the referencing elements
   * pointing at the destroyed originals, and the plate then renders as solid
   * black with no letterforms at all. Keeping one set of resources for the
   * life of the component is the reliable answer in every engine. Unique ids
   * are the belt to that braces: two instances on one page cannot collide.
   */
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  const ID = { glyphs: `${uid}-glyphs`, reveal: `${uid}-reveal` };

  const [study, setStudy] = useState<StudyId>(DEFAULT_STUDY);
  const [rate, setRate] = useState(1);
  const [paused, setPaused] = useState(false);
  const [guides, setGuides] = useState(false);
  const [run, setRun] = useState(0);

  const overlay = useRef<HTMLDivElement>(null);
  const preload = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const slab = useRef<SVGPathElement>(null);
  const plate = useRef<SVGPathElement>(null);
  const clipReveal = useRef<SVGPathElement>(null);
  const glyphs = useRef<SVGGElement>(null);
  const guideLayer = useRef<SVGGElement>(null);

  const anchors = useRef<Anchors | null>(null);
  const clock = useRef({ rate: 1, paused: false, t: 0, guides: false });

  useEffect(() => {
    clock.current.rate = rate;
  }, [rate]);
  useEffect(() => {
    clock.current.paused = paused;
  }, [paused]);

  /* ---------------------------------------------------------------- draw */

  const measure = useCallback(() => {
    const a = readAnchors();
    anchors.current = a;
    svg.current?.setAttribute("viewBox", `0 0 ${a.vw} ${a.vh}`);
    return a;
  }, []);

  const draw = useCallback((t: number, id: StudyId) => {
    const a = anchors.current;
    if (!a) return;
    // The law is one law; its proportions are art-directed per profile.
    const s = resolveStudy(STUDIES[id], a.profile);
    const w = solveSweep(a, s, t);

    slab.current?.setAttribute(
      "d",
      bandPath(w.slabFrom, w.slabTo, w.slabAxis, w.slant, a.vw, a.vh),
    );
    plate.current?.setAttribute(
      "d",
      bandPath(w.plateFrom, w.plateTo, w.plateAxis, w.slant, a.vw, a.vh),
    );
    // The aperture does not travel. It is the one place the mark can be.
    glyphs.current?.setAttribute(
      "transform",
      `translate(${a.markX} ${a.markY}) scale(${a.markScale})`,
    );
    clipReveal.current?.setAttribute("d", rightOfPath(w.revealX, w.slant, a.vw, a.vh));

    if (clock.current.guides) paintGuides(guideLayer.current, a, id, t);
  }, []);

  /* ------------------------------------------------------------- lifecycle */

  const reduced = useRef(false);

  useLayoutEffect(() => {
    reduced.current =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) overlay.current?.classList.add(styles.reduced);
    measure();
    draw(reduced.current ? ALIGNMENT_SCORE.lockMid : 0, DEFAULT_STUDY);
    // Absence has been painted with the document; the measured opening frame
    // replaces it before this commit reaches the screen, so there is no window
    // in which the homepage underneath shows through.
    if (preload.current) preload.current.hidden = true;
    // Mount only: a resize or a re-render must never restart the sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The homepage is mounted and laid out from the first frame, so its autoplay
  // previews may load and start now. This reuses the production scheduler's
  // existing prewarm window — it does not duplicate or replace it.
  useEffect(() => {
    setPreviewPrewarm(true);
    return () => setPreviewPrewarm(false);
  }, []);

  useEffect(() => {
    const onResize = () => {
      measure();
      draw(clock.current.t, study);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure, draw, study]);

  useEffect(() => {
    clock.current.guides = guides;
    if (!guides) paintGuides(guideLayer.current, null, study, 0);
    else if (anchors.current) paintGuides(guideLayer.current, anchors.current, study, clock.current.t);
  }, [guides, study]);

  useEffect(() => {
    if (done) return;
    measure();

    // Reduced motion: the register, drawn once and held, then taken away by
    // the stylesheet. No travelling planes, no 1.6s sequence.
    if (reduced.current) {
      draw(ALIGNMENT_SCORE.lockMid, study);
      const id = window.setTimeout(
        () => setDone(true),
        ALIGNMENT_REDUCED.hold + ALIGNMENT_REDUCED.fade,
      );
      return () => window.clearTimeout(id);
    }

    let raf = 0;
    // -1, not 0: the very first callback establishes the origin, and every
    // callback after it contributes its full delta.
    let last = -1;
    clock.current.t = 0;
    draw(0, study);

    const tick = (now: number) => {
      if (last >= 0 && !clock.current.paused) {
        clock.current.t += (now - last) * clock.current.rate;
      }
      last = now;
      const t = Math.min(clock.current.t, ALIGNMENT_TOTAL_MS);
      draw(t, study);
      if (t >= ALIGNMENT_TOTAL_MS && !clock.current.paused) {
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, study, done, measure, draw]);

  // Hand the previews back to the ordinary rules a frame after the overlay is
  // gone, so the observer reports the uncovered page rather than the covered
  // one. Same reasoning as the production intro.
  useEffect(() => {
    if (!done) return;
    const frames: number[] = [];
    frames.push(
      requestAnimationFrame(() => {
        frames.push(requestAnimationFrame(() => setPreviewPrewarm(false)));
      }),
    );
    return () => frames.forEach(cancelAnimationFrame);
  }, [done]);

  // Development guard for the official geometry: the embedded path data must
  // stay identical to the asset. Never runs in a production build.
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
            "[AlignmentIntro] embedded wordmark geometry differs from",
            WORDMARK.source,
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const replay = useCallback(() => {
    clock.current.t = 0;
    setPaused(false);
    setDone(false);
    setRun((n) => n + 1);
  }, []);

  const chooseStudy = useCallback((id: StudyId) => {
    clock.current.t = 0;
    setStudy(id);
    setPaused(false);
    setDone(false);
    setRun((n) => n + 1);
  }, []);

  /* ----------------------------------------------------------------- render */

  return (
    <div className={styles.stage}>
      {children}

      <div
        ref={overlay}
        className={done ? `${styles.overlay} ${styles.finished}` : styles.overlay}
        aria-hidden="true"
      >
        {/* Server-rendered, and the first thing painted: absence. */}
        <div ref={preload} className={styles.preload} />

        <svg
          ref={svg}
          className={styles.svg}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          focusable="false"
        >
          <defs>
            {/* The wordmark, cut out of the plate. One mask over one
                rectangle — the mark is never divided between surfaces. */}
            <mask
              id={ID.glyphs}
              maskUnits="userSpaceOnUse"
              x={PLATE_RECT.x}
              y={PLATE_RECT.y}
              width={PLATE_RECT.w}
              height={PLATE_RECT.h}
            >
              <rect {...plateRect()} fill="#fff" />
              <g ref={glyphs} fill="#000" transform="translate(-9999 -9999)">
                {WORDMARK.paths.map((p) => (
                  <path key={p.d} d={p.d} fillRule={p.evenOdd ? "evenodd" : undefined} />
                ))}
              </g>
            </mask>

            {/* One broad edge takes the whole intro away at the end. */}
            <clipPath id={ID.reveal} clipPathUnits="userSpaceOnUse">
              <path ref={clipReveal} d={FULL_PLANE} />
            </clipPath>
          </defs>

          <g clipPath={`url(#${ID.reveal})`}>
            <rect {...plateRect()} fill="#000000" />
            <path ref={slab} fill="#ffffff" />
            <path ref={plate} fill="#000000" mask={`url(#${ID.glyphs})`} />
          </g>

          <g ref={guideLayer} />
        </svg>
      </div>

      {DEV && (
        <AlignmentDevPanel
          study={study}
          rate={rate}
          paused={paused}
          guides={guides}
          onStudy={chooseStudy}
          onRate={setRate}
          onPause={() => setPaused((p) => !p)}
          onGuides={() => setGuides((g) => !g)}
          onReplay={replay}
        />
      )}
    </div>
  );
}

function plateRect() {
  return { x: PLATE_RECT.x, y: PLATE_RECT.y, width: PLATE_RECT.w, height: PLATE_RECT.h };
}

/**
 * Development-only: the mark's box, the slab's two edges, the plate's leading
 * edge and the one page line the reveal answers to. Written imperatively so it
 * costs nothing and changes nothing when it is off, which is the default.
 */
function paintGuides(layer: SVGGElement | null, a: Anchors | null, id: StudyId, t: number) {
  if (!layer) return;
  layer.replaceChildren();
  if (!a) return;
  const s = resolveStudy(STUDIES[id], a.profile);
  const w = solveSweep(a, s, t);
  const add = (tag: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    layer.appendChild(el);
  };
  add("line", {
    x1: a.spineX, y1: 0, x2: a.spineX, y2: a.vh,
    stroke: "#ff2d55", "stroke-width": 1, "stroke-dasharray": "4 4",
  });
  add("line", {
    x1: 0, y1: a.headerSeamY, x2: a.vw, y2: a.headerSeamY,
    stroke: "#00e0ff", "stroke-width": 1, "stroke-dasharray": "4 4",
  });
  add("rect", {
    x: a.markX, y: a.markY, width: a.markW, height: a.markH,
    fill: "none", stroke: "#7cff5a", "stroke-width": 1,
  });
  add("path", {
    d: bandPath(w.slabFrom, w.slabTo, w.slabAxis, w.slant, a.vw, a.vh),
    fill: "none", stroke: "#ffd60a", "stroke-width": 1,
  });
  add("path", {
    d: bandPath(w.plateFrom, w.plateTo, w.plateAxis, w.slant, a.vw, a.vh),
    fill: "none", stroke: "#ff9f0a", "stroke-width": 1,
  });
  add("path", {
    d: bandPath(w.revealX - 1, w.revealX + 1, "right", w.slant, a.vw, a.vh),
    fill: "#ffffff", opacity: 0.5,
  });
  const label = document.createElementNS(SVG_NS, "text");
  label.setAttribute("x", "12");
  label.setAttribute("y", String(a.vh - 12));
  label.setAttribute("fill", "#7cff5a");
  label.setAttribute("font-size", "11");
  label.setAttribute("font-family", "monospace");
  label.textContent = `${STUDIES[id].name}  plate ${Math.round(plateLength(a, s.plateSpan))}px  mark ${a.markW}px  white-behind ${w.slabCoversMark ? "yes" : "no"}  t ${Math.round(t)}`;
  layer.appendChild(label);
}
