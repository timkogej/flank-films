/**
 * FLANK brand typography.
 *
 * The brand face is HELVETICA NOW. No licensed Helvetica Now web font files
 * were found on this machine, and the family must not be sourced from
 * unauthorised mirrors, so the site currently runs on the fallback stack
 * declared by `--font-brand` in globals.css:
 *
 *   "Helvetica Now", "Helvetica Neue", Helvetica, Arial, sans-serif
 *
 * All sizing/tracking is calibrated for Helvetica Now proportions.
 *
 * TO ACTIVATE THE LICENSED FAMILY (single, contained change):
 *   1. Drop the woff2 files into `src/styles/fonts/`.
 *   2. Uncomment the `localFont` block below.
 *   3. Set `brandFontClassName = helveticaNow.variable` and point
 *      `--font-brand` in globals.css at `var(--font-helvetica-now)`.
 * Nothing else in the codebase needs to change.
 */

// import localFont from "next/font/local";
//
// const helveticaNow = localFont({
//   src: [
//     { path: "./fonts/HelveticaNow-Regular.woff2", weight: "400", style: "normal" },
//     { path: "./fonts/HelveticaNow-Medium.woff2", weight: "500", style: "normal" },
//     { path: "./fonts/HelveticaNow-Bold.woff2", weight: "700", style: "normal" },
//   ],
//   variable: "--font-helvetica-now",
//   display: "swap",
//   fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
// });

/** Applied to <body>. Empty while the fallback stack is active. */
export const brandFontClassName = "";
