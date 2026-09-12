/**
 * FLANK intro — single source of truth for behaviour and timing.
 *
 * The CSS owns the motion itself (see FlankIntro.module.css, which reads the
 * same numbers from custom properties). `INTRO_TOTAL_MS` only tells React when
 * the sequence is over so it can drop the overlay and clear the transform.
 * Keep the two in sync — they are both derived from the table below.
 */

/**
 * First-load behaviour.
 *   "every-load" — plays on every fresh homepage load / refresh (current).
 *   "off"        — never plays; the homepage renders in its final state.
 *
 * A future "once-per-session" mode belongs here too, but it needs a blocking
 * inline script to read sessionStorage before first paint (otherwise the intro
 * paints and is then yanked away). Not worth it until the behaviour is chosen.
 */
export const INTRO_MODE: "every-load" | "off" = "every-load";

/**
 * Choreography, in milliseconds. These mirror the custom properties in
 * FlankIntro.module.css one-for-one.
 *
 *   0      black fills the viewport (server-rendered, so it is the first paint)
 *   100    wordmark begins to resolve
 *   360    wordmark fully established
 *   460    light beam starts its single pass
 *   1180   beam has left the frame
 *   1120   homepage begins rising from the bottom edge   (overlaps the beam)
 *   1840   homepage seated; intro removed
 */
export const INTRO_TIMING = {
  logoInDelay: 100,
  logoIn: 260,
  beamDelay: 460,
  beam: 720,
  riseDelay: 1120,
  rise: 720,
} as const;

export const INTRO_TOTAL_MS = INTRO_TIMING.riseDelay + INTRO_TIMING.rise;

/** Reduced-motion path: no sweep, just a short, quiet reveal. */
export const INTRO_REDUCED_TOTAL_MS = 340;
