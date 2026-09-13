/**
 * Central site configuration.
 *
 * Social URLs are PLACEHOLDERS — final accounts are not confirmed yet.
 * They are kept here so no fake URL is ever scattered through a component.
 */

export const site = {
  name: "FLANK",
  legalName: "FLANK FILMS",
  description:
    "FLANK FILMS — commercial production company. Films, advertising and visual content for agencies and brands.",
  url: "https://flankfilms.com",
} as const;

export const social = {
  /** TODO: replace with the final FLANK Instagram account. */
  instagram: "https://www.instagram.com/",
  /** TODO: replace with the final FLANK LinkedIn page. */
  linkedin: "https://www.linkedin.com/",
} as const;

/**
 * The site's own pages, in header order.
 *
 * Two destinations, because the site has two. The header renders this on a
 * wide bar and the phone menu renders the same list in its own shape — one
 * array, so a page can never appear in one and not the other.
 *
 * `label` is the wide-bar wording and `short` the phone wording. They differ
 * for exactly one entry: a phone bar says ABOUT, where the desktop bar has the
 * room to say ABOUT & CONTACT. Same href either way — the About page carries
 * the contact details, so the shorter word loses nothing.
 */
export const pages = [
  { key: "home", href: "/", label: "Home", short: "Home" },
  {
    key: "about",
    href: "/about",
    label: "About & Contact",
    short: "About",
  },
] as const;

export type PageKey = (typeof pages)[number]["key"];

/** The social accounts, in header order. Same order in the phone menu. */
export const socialLinks = [
  { key: "instagram", label: "Instagram", href: social.instagram },
  { key: "linkedin", label: "LinkedIn", href: social.linkedin },
] as const;

/**
 * Development-only affordance: the small project number drawn on each
 * placeholder frame. It exists purely to make the mosaic reviewable while the
 * real media is missing and is NOT part of the design.
 *
 * Set to `false` (or delete this constant and its single use in ProjectCard)
 * to remove it from production. Nothing else depends on it.
 */
export const SHOW_PLACEHOLDER_IDS = false;

/**
 * The element wrapping every route's own markup, inside <body>.
 *
 * The project viewer renders as a sibling of it, not inside it, which is what
 * lets the viewer make the whole page behind it inert with one attribute while
 * staying interactive itself.
 */
export const SITE_ROOT_ID = "site-root";

/**
 * Whether the mosaic is navigation.
 *
 * True: each frame is a real link to /work/[slug] and the viewer opens over
 * the homepage. False: the frames are keyboard-reachable previews with no
 * destination, exactly as they were before the viewer existed. The routes
 * themselves always exist — this is a switch on the mosaic, not on the
 * feature.
 *
 * Either way /work/[slug] is not a page a visitor can land on: loaded
 * directly it redirects to the homepage. See app/work/[slug]/page.tsx.
 */
export const PROJECT_VIEWER_ENABLED = true;
