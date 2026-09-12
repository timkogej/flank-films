/**
 * DARK LIGHT intro — the whole score in one table.
 *
 * Every number that decides how the piece feels lives here or in the matching
 * custom properties at the top of DarkLightIntro.module.css. Nothing is tuned
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
 * Choreography, in milliseconds, as absolute marks on one timeline rather
 * than a pile of delays and durations — that is the form the piece is
 * actually judged in ("the reflection leaves the K at 1.08s"), so it is the
 * form it is written in. The durations CSS needs are derived below.
 *
 * The mark does not arrive. It is already there in the first painted frame,
 * at full size and full contrast, and it never moves — so there is no reveal
 * beat on this timeline at all. The only thing that travels is the light.
 *
 *   0      dark graphite field, black FLANK already sitting in it
 *   180    the reflection reaches the F
 *   1080   it has left the K; the mark is black again
 *   1300   end of the hold
 *   1300   the real homepage starts rising from the bottom edge
 *   1940   the homepage is seated; the intro is over
 */
export const DARK_LIGHT_SCORE = {
  shineStart: 180,
  shineEnd: 1080,
  holdEnd: 1300,
  pageRiseStart: 1300,
  pageRiseEnd: 1940,
} as const;

/** Durations CSS animates over. Derived, never written down twice. */
export const DARK_LIGHT_TIMING = {
  staticHold: DARK_LIGHT_SCORE.shineStart,
  shineDelay: DARK_LIGHT_SCORE.shineStart,
  shine: DARK_LIGHT_SCORE.shineEnd - DARK_LIGHT_SCORE.shineStart,
  hold: DARK_LIGHT_SCORE.holdEnd - DARK_LIGHT_SCORE.shineEnd,
  riseDelay: DARK_LIGHT_SCORE.pageRiseStart,
  rise: DARK_LIGHT_SCORE.pageRiseEnd - DARK_LIGHT_SCORE.pageRiseStart,
} as const;

/**
 * The desktop total.
 *
 * Only a fallback: the component ends the sequence on the riser animation's
 * own `finished`, so pausing it or running it at 0.5x cannot desynchronise the
 * overlay from the page, and the phone profile's slightly different numbers
 * (see the `max-width: 699px` block in the stylesheet) need no second constant
 * to stay correct. This value is used only if an engine reports no animations.
 */
export const DARK_LIGHT_TOTAL_MS = DARK_LIGHT_SCORE.pageRiseEnd;

/**
 * Reduced motion: the object is drawn once and held, then taken away. No
 * travelling light, no travelling page. Deliberately not "the same thing,
 * slower" — and because the mark is static in the full version anyway, the
 * reduced path is the same frame, simply without the reflection.
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
