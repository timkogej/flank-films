/**
 * Project viewer — timings and policy, in one place.
 *
 * Every duration here has a twin in ProjectViewer.module.css, declared as a
 * custom property on the viewer root. JS owns the numbers that decide WHEN a
 * route changes; CSS owns the motion. They are derived from this table and
 * must be tuned together.
 */

/** Backdrop and film entrance. */
export const VIEWER_OPEN_DURATION = 380;

/** Exit. The route is not touched until this has finished playing out. */
export const VIEWER_CLOSE_DURATION = 260;

/** Previous/next: the outgoing film fades, the route changes, the incoming
 *  film fades up. The shell never moves during either half. */
export const PROJECT_SWITCH_OUT_DURATION = 160;
export const PROJECT_SWITCH_IN_DURATION = 200;

/** Quiet time before the controls fade during clean playback. */
export const CONTROL_HIDE_DELAY = 2000;

/**
 * The same idea, given a moment longer on touch.
 *
 * A pointer stops the instant the hand does; a finger lifts, travels and comes
 * back, and 2.0s repeatedly hid the controls in the middle of reaching for
 * them. Capability, not width — a tablet with a trackpad gets the pointer
 * timing, a phone gets this one.
 */
export const CONTROL_HIDE_DELAY_TOUCH = 2600;

/** Poster -> film crossfade, matching Phase 4.2's language. */
export const FILM_FADE_DURATION = 220;

/**
 * How long a stall must last before it is worth admitting to.
 *
 * A decoder hiccup between two frames is not a loading state, and flashing an
 * indicator at every one of them is how a quiet player starts to feel busy.
 */
export const BUFFER_INDICATOR_DELAY = 420;

/* --------------------------------------------------------------------------
   Swipe navigation.

   A secondary convenience, never the only way through the work: Previous and
   Next stay on screen, keyboard still works, and nothing is announced or
   taught. The thresholds exist to make a swipe an intention rather than an
   accident — a tap, a vertical drag and a diagonal wander all have to fail
   before a project changes.
   -------------------------------------------------------------------------- */

/** Horizontal travel before a gesture counts as a swipe at all. */
export const SWIPE_MIN_DISTANCE = 60;

/** ...and it must be this much more horizontal than vertical. */
export const SWIPE_DOMINANCE = 1.6;

/** A slow drag across the film is not a swipe; it is someone resting a thumb. */
export const SWIPE_MAX_DURATION = 700;

/**
 * When a film ends, stay on it.
 *
 * Deciding for the viewer that they want the next piece of work is a real
 * editorial choice and it has not been made yet. The player already knows how
 * to advance — this is the switch, not a missing feature.
 */
export const AUTO_ADVANCE_PROJECT = false;
