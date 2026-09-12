/**
 * FLANK intro — ALIGNMENT LOCK prototype. PROTOTYPE ONLY.
 *
 * Nothing here is imported by the production intro (today
 * `src/components/IntroDarkLight`), the Intro V2 video prototype
 * (`src/components/IntroV2`), the homepage, the mosaic or any project route.
 * `src/app/intro-alignment-test` — the only thing that ever imported it — was
 * removed before the first deploy, so this folder is now unreachable source:
 * it ships in no bundle and there is no URL that renders it. It is kept for
 * future experimentation and can be deleted in one move with no other edit.
 *
 * It reads only the shared brand wordmark, so retiring it frees no media.
 *
 * ── THE LAW ────────────────────────────────────────────────────────────────
 * Two large surfaces cross a fixed point, on different axes:
 *
 *   SLAB    a big white plane, sweeping on one axis
 *   PLATE   a big black plane, sweeping on the other, with the official
 *           wordmark cut out of it
 *
 * The aperture does not travel. It sits exactly where the mark belongs, and it
 * is nothing on its own: a hole in black shows black, and the slab is a plain
 * rectangle with no letterform anywhere in it. The mark exists only where all
 * three coincide — plate over slab over that one place.
 *
 * So the slab arrives first and lays white behind the mark's position. Then
 * the plate sweeps across and the wordmark is written into the black in its
 * wake, bounded at every instant by the plate's own leading edge. When the
 * plate has covered the frame the mark stands alone and complete. When its
 * back edge passes, the white returns and the mark dissolves into it.
 *
 * That is the whole trick, and it is why nothing can look torn: the mark is
 * never cut by anything except a large moving edge the viewer can see.
 *
 * The white the mark dissolves into is the page's own ground, and one broad
 * edge takes it away.
 */

/* ==========================================================================
   1. THE OFFICIAL WORDMARK
   ==========================================================================
   Verbatim path data from `public/brand/flank-wordmark-white.svg`. Only ever
   translated and uniformly scaled — never redrawn, retyped or restretched, and
   never cut into pieces. `AlignmentIntro` re-fetches the asset in development
   and warns if this copy has drifted from it. */

export interface GlyphPath {
  d: string;
  evenOdd?: boolean;
}

export const WORDMARK: {
  source: string;
  viewBox: { w: number; h: number };
  paths: GlyphPath[];
} = {
  source: "/brand/flank-wordmark-white.svg",
  viewBox: { w: 1499, h: 226 },
  paths: [
    { d: "M 0 0 L 268 0 L 268 67 L 93 67 L 93 97 L 244 97 L 244 157 L 93 157 L 93 226 L 0 226 Z" },
    { d: "M 290 0 L 383 0 L 383 162 L 529 162 L 529 226 L 290 226 Z" },
    {
      d: "M 538 225 L 630 226 L 651 192 L 753 192 L 764 194 L 778 226 L 875 226 L 762 0 L 654 0 Z M 706 75 L 677 136 L 735 136 Z",
      evenOdd: true,
    },
    { d: "M 888 0 L 888 226 L 980 226 L 981 115 L 1085 226 L 1184 226 L 1184 0 L 1097 0 L 1096 121 L 978 0 Z" },
    { d: "M 1206 0 L 1206 226 L 1298 226 L 1298 176 L 1329 149 L 1389 226 L 1498 226 L 1394 96 L 1498 0 L 1385 0 L 1298 83 L 1298 0 Z" },
  ],
};

/* ==========================================================================
   2. THE SCORE, in milliseconds from the first painted frame
   ==========================================================================
   The four middle marks are not tuned numbers — the geometry is solved from
   them. Whatever the viewport, the plate has advanced exactly one mark width
   between `resolve` and `lockStart`, exactly one band width between
   `lockStart` and `lockEnd`, and one mark width again to `passEnd`. The lock
   is therefore 180ms by construction at every size. */

export const ALIGNMENT_SCORE = {
  /** Absence. Nothing is drawn. */
  blackEnd: 100,
  /** The white plane sweeps in. No letterform anywhere on screen. */
  approachStart: 100,
  /** The black plane's leading edge reaches the mark and starts writing it. */
  writeStart: 470,
  /** The edge has cleared the mark: it is whole, with white still beside it. */
  markWhole: 580,
  /** The plane now holds the entire frame. The mark is alone on black. */
  lockStart: 650,
  lockMid: 730,
  /** Its back edge re-enters the frame. The mark is still whole. */
  lockEnd: 810,
  /** That back edge reaches the mark and starts taking it back. */
  eraseStart: 850,
  /** The back edge has cleared it; the mark has gone back into the white. */
  passEnd: 960,
  /** One broad edge starts uncovering the page. */
  revealStart: 1110,
  /** …passing exactly along the mosaic's full-height gutter. */
  spineAt: 1330,
  revealEnd: 1620,
} as const;

export const ALIGNMENT_TOTAL_MS = ALIGNMENT_SCORE.revealEnd;

/** Reduced motion: a still register, then out. No travelling planes. */
export const ALIGNMENT_REDUCED = { hold: 300, fade: 200 } as const;

/* ==========================================================================
   3. EASING — three curves, and a straight line
   ========================================================================== */

export type Ease = readonly [number, number, number, number];

export const EASE = {
  DRIVE: [0.16, 0.84, 0.24, 1],
  GLIDE: [0.4, 0, 0.15, 1],
  RELEASE: [0.62, 0, 0.2, 1],
  LINEAR: [0, 0, 1, 1],
} as const satisfies Record<string, Ease>;

/* ==========================================================================
   4. TRACKS
   ==========================================================================
   `v` is a fraction of the viewport (vw for x, vh for y). `e` eases the
   segment that STARTS at that key. */

export interface Key {
  t: number;
  v: number;
  e?: Ease;
}
export type Track = readonly Key[];

export type Profile = "desktop" | "tablet" | "mobile";

/* ==========================================================================
   5. THE THREE STUDIES
   ==========================================================================
   Same law, three compositions. Each is two large surfaces and one broad
   reveal. None of them has a shape smaller than a third of the viewport. */

export type StudyId = "A" | "B" | "C";

/** Which way a surface sweeps. */
export type Axis = "down" | "up" | "right" | "left";

export interface Study {
  id: StudyId;
  name: string;
  note: string;
  /**
   * Edge lean, as a fraction of the frame's cross-axis: the offset of every
   * edge at one end of the frame, mirrored at the other. `0` is square. One
   * angle is shared by both surfaces and by the reveal, so the composition is
   * built from a single line.
   */
  slant: number;
  /** The black plane: which way it sweeps, and its own travel. */
  plate: Axis;
  /**
   * Plate length, as a multiple of the frame along its own axis. It has to be
   * long enough to hold the whole frame for the length of the register while
   * its leading edge is already past the mark and its back edge is not yet at
   * it — which is what makes the register a clean black frame and not just a
   * complete mark with white still beside it.
   */
  plateSpan: number;
  /** The white plane: which way it sweeps, how deep it is, and its track. */
  slab: Axis;
  slabSpan: number;
  slabTrack: Track;
  /** The reveal edge. Re-zeroed so it crosses the mosaic gutter at `spineAt`. */
  reveal: Track;
  responsive?: Partial<Record<Exclude<Profile, "desktop">, StudyOverride>>;
}

export type StudyOverride = Partial<
  Pick<Study, "slant" | "plateSpan" | "slabSpan" | "slabTrack" | "reveal">
>;

export function resolveStudy(study: Study, profile: Profile): Study {
  if (profile === "desktop") return study;
  const over = study.responsive?.[profile];
  return over ? { ...study, ...over } : study;
}

/**
 * The reveal: parked, then one broad move. Values are fractions of the
 * viewport, re-zeroed by the solver so the edge crosses the mosaic's only
 * full-height gutter at `spineAt`.
 */
const REVEAL: Track = [
  { t: 0, v: -1.35, e: EASE.LINEAR },
  { t: ALIGNMENT_SCORE.revealStart, v: -1.35, e: EASE.DRIVE },
  { t: ALIGNMENT_SCORE.spineAt, v: 0, e: EASE.GLIDE },
  { t: ALIGNMENT_SCORE.revealEnd, v: 1.0 },
];

/**
 * The white plane's leading edge, as a fraction of the frame along its own
 * axis: 0 is the near edge of the frame, 1 the far one. It has to be past the
 * mark before the plate arrives and still behind it at the end — the solver
 * checks both in development.
 */
const SLAB_IN: Track = [
  // Far enough above the frame that the lean cannot show a corner of it during
  // the opening hold: a leaning edge reaches the frame before its midpoint does.
  { t: 0, v: -0.16, e: EASE.LINEAR },
  { t: ALIGNMENT_SCORE.approachStart, v: -0.1, e: EASE.DRIVE },
  { t: 380, v: 0.6, e: EASE.GLIDE },
  { t: 700, v: 0.95, e: EASE.RELEASE },
  { t: ALIGNMENT_SCORE.revealEnd, v: 1.25 },
];

export const STUDIES: Record<StudyId, Study> = {
  /* ------------------------------------------------------------------------
     A — PRESS. The white plane comes down the frame, the black plane goes
     across it. Two surfaces, two axes, one shared lean. The mark is written
     left to right in the black plane's wake and dissolves back into white
     behind it — which is already the page's ground colour. */
  A: {
    id: "A",
    name: "Press",
    note: "White descends, black sweeps across it; white hands off to the page.",
    slant: 0.055,
    plate: "right",
    plateSpan: 1.9,
    slab: "down",
    slabSpan: 1.85,
    slabTrack: SLAB_IN,
    reveal: REVEAL,
    responsive: {
      mobile: { slant: 0.03, plateSpan: 1.75, slabSpan: 1.5 },
      tablet: { slant: 0.045, slabSpan: 1.7 },
    },
  },

  /* ------------------------------------------------------------------------
     B — CROSS. Both planes travel horizontally, in opposite directions, on
     square edges. The white comes in from the right as the black comes in
     from the left, and they pass through each other at the mark. The hardest,
     fastest reading of the same law. */
  B: {
    id: "B",
    name: "Cross",
    note: "Opposite directions on one axis, square edges; the planes pass through each other.",
    slant: 0,
    plate: "right",
    plateSpan: 1.9,
    slab: "left",
    slabSpan: 1.85,
    slabTrack: SLAB_IN,
    reveal: REVEAL,
    responsive: {
      mobile: { plateSpan: 1.75, slabSpan: 1.6 },
      tablet: { slabSpan: 1.7 },
    },
  },

  /* ------------------------------------------------------------------------
     C — RISE. The white plane comes UP the frame and the black plane runs
     right to left, so the mark is written from its last letter to its first.
     A harder lean, and the whole composition reads bottom-left to top-right. */
  C: {
    id: "C",
    name: "Rise",
    note: "White rises, black runs right to left; the mark writes in reverse.",
    slant: 0.11,
    plate: "left",
    plateSpan: 1.9,
    slab: "up",
    slabSpan: 1.85,
    slabTrack: SLAB_IN,
    reveal: REVEAL,
    responsive: {
      mobile: { slant: 0.06, plateSpan: 1.75, slabSpan: 1.5 },
      tablet: { slant: 0.09, slabSpan: 1.7 },
    },
  },
};

/** The winner. See the design notes in the prototype route. */
export const DEFAULT_STUDY: StudyId = "A";
