/**
 * DARK LIGHT intro — the whole score in one table.
 *
 * Every number that decides how the piece feels lives here (all pacing) or in
 * the custom properties at the top of DarkLightIntro.module.css (the look). Nothing is tuned
 * inside a selector further down that file, and nothing is tuned in the
 * component: React owns what exists and when the sequence is over, CSS owns
 * every frame.
 */

/**
 * Document-load behaviour.
 *   "every-load" — plays whenever the browser loads `/` or `/about` as a
 *                  document: a fresh visit, a new tab, a refresh (current).
 *   "off"        — never plays; the page renders in its final state.
 *
 * Which routes have an intro is decided by which pages are wrapped in
 * DarkLightIntro — today `/` and `/about`, the only two pages the site has.
 * A direct /work/[slug] redirects to `/`, so it arrives at the intro the same
 * way any other first visit to the homepage does.
 *
 * "Every load" means every DOCUMENT load, never every mount. Arriving at a
 * wrapped page by client-side navigation — Home, About, the wordmark, browser
 * Back or Forward, closing a film, or from any directly-loaded page — renders
 * the finished page with no curtain at all. DarkLightIntro tells the two
 * apart by whether it is hydrating server HTML; see `entrance` there.
 *
 * This is deliberately not a "once per session" switch: a refresh must play
 * the intro again, so nothing is remembered in storage.
 */
export const DARK_LIGHT_MODE: "every-load" | "off" = "every-load";

/**
 * Choreography, in milliseconds — the ONLY place the intro's pacing is
 * written down. Four beats, played back to back, one sequence:
 *
 *   initialHold    graphite field, black FLANK already sitting in it, and
 *                  nothing moving. Long enough to register the mark as the
 *                  mark before anything happens to it.
 *   shineDuration  the one reflection, from touching the F to clearing the K.
 *   postShineHold  the mark black again, still — a beat, not a second scene.
 *   riseDuration   the real page rising from the bottom edge until seated.
 *
 * The mark does not arrive. It is already there in the first painted frame,
 * at full size and full contrast, and it never moves — so there is no reveal
 * beat here at all. The only thing that travels is the light, then the page.
 *
 * Pacing was lengthened from a ~1.94s score (180 / 900 / 220 / 640) because
 * the mark went by before it was read. The extra time is also real preload
 * time: the page is mounted behind the curtain from the first frame and its
 * posters, preview loops and first About film load while this plays. It is
 * never a loading gate — the score is fixed and nothing here waits on media.
 *
 * The holds read longer than they are written, on purpose: the reflection
 * field's leading and trailing ~15-20% carry almost no light on the mark, so
 * the eye sees roughly 570ms of stillness before the light and 500ms after it.
 * That is why the written holds sit at the low end of what was tried: longer,
 * and the post-shine beat stops being a beat and becomes a pause.
 *
 * `phone` applies at the stylesheet's `max-width: 699px` breakpoint. It runs
 * a touch shorter: the mark is physically smaller, so the same light crosses
 * it in less real distance and reads as slower at the same duration.
 *
 * The component hands these to the stylesheet as custom properties on the
 * stage, server-rendered, so CSS never carries a second copy of a number.
 */
export const INTRO_SCORE = {
  desktop: {
    initialHold: 380,
    shineDuration: 1200,
    postShineHold: 320,
    riseDuration: 740,
  },
  phone: {
    initialHold: 360,
    shineDuration: 1160,
    postShineHold: 300,
    riseDuration: 700,
  },
} as const;

export type IntroProfile = (typeof INTRO_SCORE)[keyof typeof INTRO_SCORE];

/**
 * The same score as absolute marks on the timeline — the form the piece is
 * judged in ("the reflection leaves the K at 1.58s") — and the delays CSS
 * needs. Derived, never written down twice.
 *
 *   desktop   0 → 380 hold · 380 → 1580 shine · 1580 → 1900 hold · 1900 → 2640 rise
 *   phone     0 → 360 hold · 360 → 1520 shine · 1520 → 1820 hold · 1820 → 2520 rise
 */
export function introMarks(p: IntroProfile) {
  const shineStart = p.initialHold;
  const shineEnd = shineStart + p.shineDuration;
  const riseStart = shineEnd + p.postShineHold;
  const riseEnd = riseStart + p.riseDuration;
  return { shineStart, shineEnd, riseStart, riseEnd } as const;
}

/**
 * The desktop total.
 *
 * Only a fallback: the component ends the sequence on the riser animation's
 * own `finished`, so pausing it or running it at 0.5x cannot desynchronise the
 * overlay from the page, and the phone profile needs no second constant to
 * stay correct. The longer of the two is used, so the fallback can never cut
 * a sequence short. Used only if an engine reports no animations.
 */
export const DARK_LIGHT_TOTAL_MS = Math.max(
  introMarks(INTRO_SCORE.desktop).riseEnd,
  introMarks(INTRO_SCORE.phone).riseEnd,
);

/**
 * Reduced motion: the object is drawn once and held, then taken away. No
 * travelling light, no travelling page. Deliberately not "the same thing,
 * slower" — and because the mark is static in the full version anyway, the
 * reduced path is the same frame, simply without the reflection.
 *
 * Deliberately NOT scaled with INTRO_SCORE: the longer cinematic pacing is for
 * the travelling light, and a visitor who asked for less motion should not wait
 * through it. 520ms total.
 */
export const DARK_LIGHT_REDUCED = { hold: 320, fade: 200 } as const;

/**
 * The official wordmark geometry, transcribed verbatim from
 * `public/brand/flank-wordmark-white.svg`.
 *
 * It exists here because the inner-edge highlight needs real paths to stroke
 * and clip against — a CSS mask can only cut a silhouette, it cannot tell you
 * where the silhouette's edges are. The same file is still what the material
 * layers are masked by, so the two must agree; DarkLightIntro checks that
 * they do, in development, on every mount.
 *
 * Nothing here may be redrawn, simplified or re-proportioned.
 */
export const WORDMARK = {
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
  ] as { d: string; evenOdd?: boolean }[],
} as const;
