import styles from "./ArrowUpRight.module.css";

/**
 * The outbound arrow — one drawing, used wherever a link leaves the page.
 *
 * Drawn, not typed. The brand stack has no ↗ (U+2197), so a text arrow is
 * whatever the device's font fallback supplies: a thin Hiragino glyph on a
 * Mac, and on an iPhone Apple Color Emoji — the same code point is in the
 * emoji set, so it arrives as a coloured pictogram. A variation selector does
 * not reliably stop that on iOS, and nothing else in CSS can choose the
 * fallback font. A few strokes of SVG in `currentColor` look the same on
 * every device.
 *
 * Proportioned from the glyph it replaces: a square of 0.95em, a stroke of
 * ~0.05em and a head a third of its size, sitting a hair below the baseline
 * — so it scales with whatever type it stands next to and inherits its
 * colour and opacity. Decorative: the link's own text names the link.
 */
export function ArrowUpRight() {
  return (
    <svg
      className={styles.arrow}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1 19 18.6 1.4M12.2 1.4h6.4v6.4" />
    </svg>
  );
}
