/**
 * FLANK intro V2 — PROTOTYPE ONLY. Step 2: the choreography inside the mark.
 *
 * Nothing here is imported by the production intro, the homepage, the mosaic or
 * any project route. `src/app/intro-v2-test` — the only thing that ever
 * imported it — was removed before the first deploy, so this folder is now
 * unreachable source: it ships in no bundle and there is no URL that renders
 * it. It is kept for future experimentation and can be deleted in one move
 * with no other edit, which is also what would retire the archived media it is
 * the last reader of (see §step1Reference below).
 *
 * To replay it, restore a page that renders `FlankIntroV2Prototype`.
 *
 * This file is the score. Every number the sequence obeys — when the white mark
 * arrives, when film enters it, when each cut lands, how each clip is framed —
 * is here, and the component only reads it. There are no delays hidden in the
 * stylesheet: the CSS knows how to draw a frame, not when.
 */


/**
 * What the prototype route is showing.
 *
 *   "step2"  the final choreography. The default, and the thing under review.
 *   "step1"  Step 1's single-field reference — the same wordmark filled with an
 *            unmodified homepage preview. Kept only so the two can be compared
 *            side by side; it is what the purpose-cut assets are an argument
 *            against, and it costs one lazily-mounted video.
 */
export type IntroV2Mode = "step2" | "step1";

/**
 * THE SCORE, in milliseconds from the first painted frame.
 *
 *   0      black
 *   200    the white wordmark begins to resolve
 *   420    white FLANK fully established — a clean beat, on its own
 *   480    film enters the mark, travelling left to right through the letters
 *   700    Pingo covers the whole word
 *   900    CUT to OTP
 *   1300   CUT to Bohinj
 *   2000   choreography over; Bohinj keeps running
 *
 * Total: 2.00s, inside the 1.9–2.2s target. The cuts are NOT evenly spaced —
 * Pingo gets 420ms because it is also carrying the reveal, OTP gets a tight
 * 400ms because a single held gesture is all it needs, and Bohinj gets 700ms
 * because it is the shot the sequence opens out into and the one Step 3 will
 * have to transition away from.
 */
export const INTRO_V2_SCORE = {
  /** Black holds until here. Nothing is drawn before it. */
  whiteIn: 200,
  /** How long the white wordmark takes to resolve. Opacity only (§4). */
  whiteInDuration: 220,
  /** Film starts entering the mark. Leaves a clean white beat of 60ms. */
  revealStart: 480,
  /** The travelling exposure, white -> Pingo. Fast on purpose. */
  revealDuration: 220,
  /** Hard cut, Pingo -> OTP. */
  otpCut: 900,
  /** Hard cut, OTP -> Bohinj. */
  bohinjCut: 1300,
  /** Choreography complete. Bohinj is established and still moving. */
  end: 2000,
} as const;

/**
 * DEV ONLY. How long the prototype sits on the finished Bohinj state before it
 * replays itself, so the sequence can be watched repeatedly without clicking.
 * Step 3 replaces the ending entirely; nothing about this number is a design
 * decision.
 *
 * It does have one hard ceiling, found in live review. The Bohinj clip is
 * 1.417s long and starts at `bohinjCut`, so it runs out at 2717ms — and a clip
 * that runs out during the hold gives you an unplanned fourth cut back to its
 * own first frame, which is precisely the thing the whole sequence is built to
 * avoid. Replaying at 2650ms keeps the hold inside the footage that exists.
 * Raising this above ~700ms reintroduces the jump.
 */
export const INTRO_V2_DEV_REPLAY_PAUSE = 650;

/** Slow motion for inspecting the cuts. Never changes the score above. */
export const INTRO_V2_QA_RATES = [1, 0.5] as const;

/**
 * The internal grade (§16).
 *
 * Much lighter than Step 1's `brightness(1.22)`, which existed only to rescue
 * homepage previews that were never framed for a letterform. These clips are
 * cut for the mark and carry their own luminance, so this is a nudge to keep
 * the silhouette intact through the darker half of the Bohinj shot rather than
 * a correction. Highlights are deliberately left alone — Bohinj's sun, OTP's
 * greens and Pingo's orange are the point.
 */
export const INTRO_V2_GRADE = "brightness(1.08) contrast(1.03) saturate(1.04)";

/**
 * A crop, expressed the way the browser wants it.
 *
 * `position` is `object-position` AND `transform-origin` on the same element:
 * `object-fit: cover` uses it to choose the band of the clip that survives the
 * mark's 6.63:1 shape, and the scale then zooms about that same point.
 *
 * The clips are cut at 5:1, so desktop already sees the full width and 75% of
 * the height — the crop values here are a final aim, not a rescue. Mobile gets
 * its own pair because the mark is only ~45px tall there: one recognisable
 * object per clip, and the environment is allowed to go (§28, §29).
 */
interface Crop {
  position: string;
  scale: number;
  mobilePosition: string;
  mobileScale: number;
}

export interface IntroV2Shot {
  /** Which beat this is. Also the DOM hook the cut switches on. */
  id: "pingo" | "otp" | "bohinj";
  /** Dedicated intro asset. Never a homepage preview, never a full film. */
  src: string;
  /** The project this moment is from, for the record. */
  project: string;
  crop: Crop;
  /**
   * Optional override of `INTRO_V2_GRADE` for this clip alone.
   *
   * Per-clip rather than shared, because the three worlds are not supposed to
   * match (§12) and correcting all of them for one shot's problem is how they
   * end up matching. Only set it where a clip genuinely needs something the
   * others do not.
   */
  grade?: string;
}

/**
 * The three moments.
 *
 * Each one is a purpose-cut derivative — see public/media/intro/README.md for
 * the exact source, in-point and crop, and for the scene-cut check that proves
 * every window sits inside ONE source shot. A clip carrying an accidental
 * second edit would read as an unplanned cut inside the mark.
 *
 * The three worlds are deliberately unalike (§12): graphic orange, live-action
 * green, natural warm gold. They are not graded toward each other. What holds
 * them together is the silhouette, not the palette.
 */
export const INTRO_V2_SHOTS: IntroV2Shot[] = [
  {
    id: "pingo",
    project: "pingo-2",
    src: "/media/intro/intro-pingo.mp4",
    crop: {
      // Opening downhill shot, framed wide enough that the helmet, both eyes,
      // beak and head contour read together across A/N. The body and ski field
      // give the face context instead of forcing one feature into every letter.
      position: "50% 50%",
      scale: 1,
      // Preserve the semantic framing on phone. Enlarging it recreated the
      // orange/eye fragments this revision is specifically correcting.
      mobilePosition: "50% 50%",
      mobileScale: 1,
    },
  },
  {
    id: "otp",
    project: "otp",
    src: "/media/intro/intro-otp.mp4",
    crop: {
      // Wide couch two-shot: the actor and room hold F/L while the hedgehog is
      // concentrated across A/N. Its purple tuft, complete eye pair, nose,
      // mouth, bow tie and rounded/spiked contour all survive in the band.
      position: "50% 50%",
      scale: 1,
      // The character is smaller but complete on phone; recognition wins over
      // filling the whole mark with green.
      mobilePosition: "50% 50%",
      mobileScale: 1,
    },
  },
  {
    id: "bohinj",
    project: "bohinj",
    src: "/media/intro/intro-bohinj.mp4",
    crop: {
      // Backlit hair through the F and L, the white shoulder in the A, sun haze
      // and the ridge across N and K. The runner drifts right through the shot,
      // so the movement is real and continuous rather than a held frame.
      position: "50% 50%",
      scale: 1,
      // Phone: hard onto the rim-lit hair and the shoulder. At 45px tall the
      // wider aim delivered warm haze and little else; this keeps one readable
      // subject and lets the landscape go, which is the mobile rule (§29).
      mobilePosition: "26% 52%",
      mobileScale: 1.6,
    },
    // The one clip that needs its own grade. It is a backlit shot into low sun,
    // so it arrives hazy: at the shared setting the ridge dissolves into the
    // sky and the mark goes soft. The lift here is almost entirely CONTRAST —
    // brightness actually comes down — which separates the hair, the shoulder
    // and the ridge again without touching the highlights that make the shot.
    grade: "brightness(1.06) contrast(1.12) saturate(1.06)",
  },
];

/**
 * Step 1's reference field: the 16:9 Bohinj preview, framed the way Step 1
 * framed it. The before, not a fourth shot.
 *
 * It used to resolve through `getProjectBySlug("bohinj")`. That project is no
 * longer active on the homepage — the portrait Bohinj is the only one — and
 * the lookup would now quietly return null, taking Step 1's reference field
 * with it. So the clip is named directly: it is a specific archived file, not
 * a project, which is what it has actually been since the mapping changed. The
 * derivatives stay in place for exactly this reason; see
 * public/media/projects/README.md, which records that they were once deleted
 * in error and had to be regenerated from the master. This function is their
 * last reader in source: retiring this prototype is what would make
 * public/media/projects/bohinj/ genuinely dead. The crop below is unchanged.
 */
function step1Reference() {
  const src = "/media/projects/bohinj/preview.mp4";
  const poster = "/media/projects/bohinj/poster.jpg";
  return {
    src,
    poster,
    crop: {
      position: "50% 39%",
      scale: 1.5,
      mobilePosition: "50% 40%",
      mobileScale: 1.72,
    } satisfies Crop,
  };
}

export const INTRO_V2_STEP1_REFERENCE = step1Reference();

/** Step 1's grade, which the reference field still needs to be legible. */
export const INTRO_V2_STEP1_GRADE =
  "brightness(1.22) contrast(1.06) saturate(1.06)";
