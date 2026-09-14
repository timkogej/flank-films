/**
 * Central site configuration.
 *
 * Social URLs live here, and only here, so no URL is ever scattered through
 * a component.
 */

export const site = {
  name: "FLANK",
  legalName: "FLANK FILMS",
  title: "FLANK FILMS — Commercial Production for Agencies",
  description:
    "Independent commercial production for creative agencies and brands, combining filmmaking craft, AI and AI-hybrid production from Slovenia across Europe.",
  entityDescription:
    "FLANK FILMS is an independent commercial production company in Slovenia, partnering with creative agencies and brands across Europe on commercial films, AI production and AI-hybrid production.",
  url: "https://flankfilms.com",
  logo: "/brand/flank-wordmark-black.svg",
  socialImage: {
    url: "/og-image.png",
    width: 1200,
    height: 630,
    alt: "FLANK FILMS wordmark",
  },
} as const;

export const aboutSeo = {
  title: "About & Contact",
  description:
    "Meet FLANK FILMS, an independent production company in Slovenia. Explore our filmmaking, AI and AI-hybrid approach for agencies, and get in touch.",
} as const;

export const social = {
  instagram: "https://www.instagram.com/flankfilms/",
  linkedin: "https://www.linkedin.com/company/flankfilms",
} as const;

export const contact = {
  email: "hello@flankfilms.com",
  phone: "+386 31 663 288",
  telephone: "+38631663288",
  location: "Slovenia",
  countryCode: "SI",
} as const;

/**
 * The site's own pages, in header order.
 *
 * Two destinations, because the site has two. The header renders this on a
 * wide bar and the phone menu renders the same list in its own shape — one
 * array, and one wording, so a page can never be named differently in the
 * two. The About page carries the contact details, which is why it says so.
 */
export const pages = [
  { key: "home", href: "/", label: "Home" },
  { key: "about", href: "/about", label: "About & Contact" },
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
