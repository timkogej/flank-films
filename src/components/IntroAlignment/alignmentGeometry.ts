/**
 * ALIGNMENT LOCK — geometry. PROTOTYPE ONLY.
 *
 * Three jobs:
 *   1. read the REAL homepage and report the two lines that matter
 *   2. solve the sweep, so the register is exact at any viewport without tuning
 *   3. turn a surface into a four-point path
 *
 * Every visible shape in the piece is a parallelogram. There are no stepped
 * contours here, and nothing is measured per letter.
 */

import {
  ALIGNMENT_SCORE,
  WORDMARK,
  type Axis,
  type Ease,
  type Profile,
  type Track,
} from "./alignmentConfig";

export type { Profile };

/* ==========================================================================
   EASING + TRACK SAMPLING
   ========================================================================== */

function bezier(e: Ease, x: number): number {
  if (e[0] === 0 && e[1] === 0 && e[2] === 1 && e[3] === 1) return x;
  const [x1, y1, x2, y2] = e;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  let t = x;
  for (let i = 0; i < 6; i += 1) {
    const fx = ((ax * t + bx) * t + cx) * t - x;
    if (Math.abs(fx) < 1e-6) break;
    const d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(d) < 1e-6) break;
    t -= fx / d;
  }
  if (t < 0 || t > 1) {
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 20; i += 1) {
      const fx = ((ax * t + bx) * t + cx) * t;
      if (fx < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
  }
  return ((ay * t + by) * t + cy) * t;
}

/** Value of a track at `t` ms. Held flat outside its own range. */
export function sample(track: Track, t: number): number {
  if (t <= track[0].t) return track[0].v;
  const last = track[track.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < track.length - 1; i += 1) {
    const a = track[i];
    const b = track[i + 1];
    if (t >= a.t && t <= b.t) {
      const p = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
      return a.v + (b.v - a.v) * bezier(a.e ?? [0, 0, 1, 1], p);
    }
  }
  return last.v;
}

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/* ==========================================================================
   HOMEPAGE ANCHORS
   ==========================================================================
   Deliberately small. The previous version mapped every moving boundary onto
   the grid and the result was over-designed; this one reads exactly two
   things: how wide the mark should be, and the one page line the reveal edge
   passes through. */

export interface Anchors {
  vw: number;
  vh: number;
  profile: Profile;
  /** The mosaic's only full-height gutter. The reveal edge crosses it. */
  spineX: number;
  /** Header/content separation — reported for the guides, not choreographed. */
  headerSeamY: number;
  markX: number;
  markY: number;
  markW: number;
  markH: number;
  markScale: number;
}

function rectOf(root: ParentNode, selector: string): DOMRect | null {
  const el = root.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
}

/**
 * The mark's width, as a fraction of the viewport.
 *
 * On desktop this is the distance between the mosaic's two long vertical
 * gutters, which lands at ~41vw at every desktop width because the grid is
 * fractional and the page inset is a constant 8px. Narrower layouts have no
 * equivalent pair, so they interpolate toward that same number rather than
 * toward their own much closer gutters — which is what keeps the mark's size
 * continuous across the 1100px breakpoint instead of jumping at it.
 */
const DESKTOP_MARK_FRACTION = 0.4132;

function markFraction(vw: number, measured: number): number {
  if (vw >= 1100) return measured;
  if (vw <= 480) return 0.8;
  if (vw <= 700) return lerp(0.8, 0.72, (vw - 480) / 220);
  return lerp(0.72, DESKTOP_MARK_FRACTION, (vw - 700) / 400);
}

export function readAnchors(root: ParentNode = document): Anchors {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const profile: Profile = vw >= 1100 ? "desktop" : vw >= 700 ? "tablet" : "mobile";

  const header = rectOf(root, "header");
  const c01 = rectOf(root, '[data-slot="01"]');
  const c04 = rectOf(root, '[data-slot="04"]');
  const c05 = rectOf(root, '[data-slot="05"]');
  const c06 = rectOf(root, '[data-slot="06"]');
  const c07 = rectOf(root, '[data-slot="07"]');

  // Named by the gutters, not by the cards: these read the two long vertical
  // separations in the composition, and which slot ids happen to bound them
  // is a fact about the current mapping. In the eight-slot mosaic the spine is
  // the column-5 gutter (01 | 04) and the right one is column 10 (04 | 05);
  // on mobile the only gutter is the one inside a pair (06 | 07).
  const spineX =
    profile === "mobile"
      ? c06 && c07
        ? (c06.right + c07.left) / 2
        : vw * 0.5
      : c01 && c04
        ? (c01.right + c04.left) / 2
        : vw * (profile === "desktop" ? 0.3347 : 0.5);

  const rightGutterX = c04 && c05 ? (c04.right + c05.left) / 2 : vw * 0.7479;
  const measured = Math.min(0.48, Math.max(0.36, (rightGutterX - spineX) / vw || DESKTOP_MARK_FRACTION));

  const markW = Math.round(vw * markFraction(vw, measured));
  const markScale = markW / WORDMARK.viewBox.w;
  const markH = WORDMARK.viewBox.h * markScale;
  // Optically centred: a lone horizontal mark on the mathematical middle reads
  // low. Slightly higher on tall screens, where there is more below it.
  const centreY = vh * (profile === "mobile" ? 0.435 : 0.455);

  return {
    vw,
    vh,
    profile,
    spineX,
    headerSeamY: header ? header.bottom + 3 : Math.round(vh * 0.065),
    markX: Math.round((vw - markW) / 2),
    markY: Math.round(centreY - markH / 2),
    markW,
    markH,
    markScale,
  };
}

/* ==========================================================================
   THE SWEEP
   ==========================================================================
   The black plane's leading edge is not authored — it is solved from the score
   and the mark, so the register is exact at every viewport with nothing to
   tune and nothing to drift:

     writeStart  the edge is on the mark's near side; the mark starts writing
     markWhole   the edge has cleared the mark; the mark is complete
     lockStart   the plane now holds the entire frame
     lockEnd     the plane's BACK edge re-enters the frame
     eraseStart  that back edge reaches the mark
     passEnd     it has cleared the mark; the mark is gone

   So the register is a clean black frame carrying a complete mark for exactly
   `lockEnd - lockStart` at any size, and at every other instant the mark's
   boundary is the plane's own edge — which is why no frame of this can read
   as a broken logo. The plane is at its fastest between `lockStart` and
   `lockEnd`, when nothing on screen can show it moving. */

export interface Sweep {
  /** The black plane, along its axis, in viewport px. */
  plateFrom: number;
  plateTo: number;
  plateAxis: Axis;
  /** The white plane, along its axis, in viewport px. */
  slabFrom: number;
  slabTo: number;
  slabAxis: Axis;
  /** Edge lean, in px, at one end of the frame. */
  slant: number;
  /** The reveal edge's x at the vertical centre. */
  revealX: number;
  /** Development only: is the white plane behind the mark right now? */
  slabCoversMark: boolean;
}

export interface SweepInput {
  slant: number;
  plate: Axis;
  plateSpan: number;
  slab: Axis;
  slabSpan: number;
  slabTrack: Track;
  reveal: Track;
}

const horizontal = (axis: Axis) => axis === "right" || axis === "left";

/**
 * Plate length: long enough for the register to last, and long enough to hold
 * the whole frame while it does — whichever is larger, with a margin so its
 * ends are never visible at the register.
 */
export function plateLength(a: Anchors, span: number): number {
  return Math.max(a.vw * span, a.markW + a.vw * 0.6);
}

export function solveSweep(a: Anchors, s: SweepInput, t: number): Sweep {
  const P = plateLength(a, s.plateSpan);
  const m = a.markW;

  // Where the plate's leading edge is, measured along its own axis in a frame
  // where the mark's near side is 0 and its far side is `m`.
  // `frameHeld` is where the leading edge has to be for the plane to hold the
  // whole frame — measured, like everything else here, from the mark's near
  // side rather than from a number someone typed.
  const near0 = s.plate === "right" ? a.markX : a.vw - (a.markX + m);
  const frameHeld = a.vw * 1.04 - near0;
  const lead = sample(
    [
      { t: ALIGNMENT_SCORE.approachStart, v: -(a.vw + P) * 0.42, e: EASE_DRIVE },
      { t: ALIGNMENT_SCORE.writeStart, v: 0, e: EASE_LINEAR },
      { t: ALIGNMENT_SCORE.markWhole, v: m, e: EASE_LINEAR },
      { t: ALIGNMENT_SCORE.lockStart, v: frameHeld, e: EASE_LINEAR },
      // Back edge at the frame's near corner: from here the white is on
      // screen again, though it has not reached the mark yet.
      { t: ALIGNMENT_SCORE.lockEnd, v: P - near0, e: EASE_LINEAR },
      { t: ALIGNMENT_SCORE.eraseStart, v: P, e: EASE_LINEAR },
      { t: ALIGNMENT_SCORE.passEnd, v: P + m, e: EASE_RELEASE },
      { t: ALIGNMENT_SCORE.revealEnd, v: P + m + a.vw * 0.9 },
    ],
    t,
  );

  // Back into viewport coordinates. Right-running plates measure from the
  // mark's left edge; left-running ones from its right edge, mirrored.
  const near = s.plate === "right" ? a.markX : a.markX + m;
  const dir = s.plate === "right" ? 1 : -1;
  const plateHead = near + dir * lead;
  const plateFrom = s.plate === "right" ? plateHead - P : plateHead;
  const plateTo = s.plate === "right" ? plateHead : plateHead + P;

  // The white plane, as a fraction of its own axis's frame length.
  const span = horizontal(s.slab) ? a.vw : a.vh;
  const depth = span * s.slabSpan;
  const p = sample(s.slabTrack, t);
  const slabHead =
    s.slab === "down" || s.slab === "right" ? p * span : span - p * span;
  const slabFrom =
    s.slab === "down" || s.slab === "right" ? slabHead - depth : slabHead;
  const slabTo =
    s.slab === "down" || s.slab === "right" ? slabHead : slabHead + depth;

  const markNear = horizontal(s.slab) ? a.markX : a.markY;
  const markFar = horizontal(s.slab) ? a.markX + m : a.markY + a.markH;

  const revealAtSpine = sample(s.reveal, ALIGNMENT_SCORE.spineAt);
  const revealX = a.spineX + (sample(s.reveal, t) - revealAtSpine) * a.vw;

  return {
    plateFrom,
    plateTo,
    plateAxis: s.plate,
    slabFrom,
    slabTo,
    slabAxis: s.slab,
    slant: s.slant * (horizontal(s.plate) ? a.vh : a.vw),
    revealX,
    slabCoversMark: slabFrom <= markNear && slabTo >= markFar,
  };
}

const EASE_DRIVE: Ease = [0.16, 0.84, 0.24, 1];
const EASE_RELEASE: Ease = [0.62, 0, 0.2, 1];
const EASE_LINEAR: Ease = [0, 0, 1, 1];

/* ==========================================================================
   PATHS
   ========================================================================== */

/** Far enough outside any viewport that a travelling plane never runs out. */
const BLEED = 4000;

/**
 * A leaning band. `from`/`to` bound it along its own axis; `slant` is the
 * offset of its two long edges at one end of the frame, mirrored at the other,
 * so those edges stay parallel and a band never closes into a wedge.
 */
export function bandPath(
  from: number,
  to: number,
  axis: Axis,
  slant: number,
  vw: number,
  vh: number,
): string {
  if (axis === "right" || axis === "left") {
    const off = (y: number) => slant * (1 - (2 * y) / vh);
    const oT = off(-BLEED);
    const oB = off(vh + BLEED);
    return [
      `M ${(from + oT).toFixed(2)} ${-BLEED}`,
      `L ${(to + oT).toFixed(2)} ${-BLEED}`,
      `L ${(to + oB).toFixed(2)} ${vh + BLEED}`,
      `L ${(from + oB).toFixed(2)} ${vh + BLEED}`,
      "Z",
    ].join(" ");
  }
  const off = (x: number) => slant * (1 - (2 * x) / vw);
  const oL = off(-BLEED);
  const oR = off(vw + BLEED);
  return [
    `M ${-BLEED} ${(from + oL).toFixed(2)}`,
    `L ${-BLEED} ${(to + oL).toFixed(2)}`,
    `L ${vw + BLEED} ${(to + oR).toFixed(2)}`,
    `L ${vw + BLEED} ${(from + oR).toFixed(2)}`,
    "Z",
  ].join(" ");
}

/** Everything to the right of a leaning edge. The reveal's clip. */
export function rightOfPath(x: number, slant: number, vw: number, vh: number): string {
  return bandPath(x, BLEED, "right", slant, vw, vh);
}

export const PLATE_RECT = { x: -BLEED, y: -BLEED, w: BLEED * 2, h: BLEED * 2 } as const;
