/**
 * About + Contact page content.
 *
 * The About copy below is final, approved brand copy. The phone number is
 * real; the email address is still a placeholder — see the TODO on that
 * export.
 */

import { visibleProjects } from "@/data/projects";

/**
 * The one piece of REAL, approved brand copy on this page.
 *
 * Two sentences, kept as two entries so the composition can never collapse
 * into a single run-on line. Line breaks INSIDE each sentence are handled by
 * the measure in CSS, not by hard breaks, so they stay intentional at every
 * width instead of only at the one it was authored on.
 */
export const brandStatement: readonly string[] = [
  "Stand beside the idea.",
  "Move the work forward.",
];

/**
 * The approved About copy. Four paragraphs, rendered as-is — no headings,
 * no manual line breaks.
 */
export const aboutParagraphs: string[] = [
  "Flank Films is an independent production company built around a simple belief: ambitious ideas deserve equally ambitious execution.",
  "Based in the Adria region and looking beyond borders, we partner with creative agencies to turn bold concepts into distinctive commercial films. We get close to the idea, understand what makes it work, and carry that thinking through every production decision, down to the final frame.",
  "Our name reflects our role. To stand beside the people behind the idea. To bring creative judgment, technical ingenuity and a shared commitment to making the work as strong as it can be. We combine filmmaking craft with AI and AI-hybrid production, opening up new possibilities for what can be imagined and brought to screen.",
  "Our vision is to help shape the next generation of European production, giving creative teams greater freedom to explore, the confidence to push further, and a partner who takes responsibility for the result.",
];

/**
 * TODO: replace the email with the real business address.
 *
 * The phone number is real. It is written here the way it should read on the
 * page — spaced, in international form — and AboutPanel derives the `tel:`
 * href from it, so there is exactly one place the number is written down.
 */
export const contact = {
  email: "hello@flankfilms.com",
  phone: "+386 31 663 288",
  /** Where the company is. Informational only — no address, no map. */
  location: "Slovenia",
} as const;

type FocalPoint = `${number}% ${number}%`;

export interface AboutReelFilm {
  slug: string;
  /** The project's full-film web derivative — never its homepage preview. */
  src: string;
  /** Per film: one shared crop cannot frame four different films. */
  focalPoint: { desktop: FocalPoint; mobile: FocalPoint };
}

/**
 * Framing per film, checked across each whole film in the ~1.64:1 desktop
 * panel and the 4:5 stacked one. Every film in the reel is 16:9, so the
 * desktop panel crops them barely at all and the mobile panel crops them
 * hard on the horizontal — which is the axis these values are really for.
 */
const REEL_FRAMING: Record<string, AboutReelFilm["focalPoint"]> = {
  otp: { desktop: "50% 42%", mobile: "50% 42%" },
  schweppes: { desktop: "50% 45%", mobile: "52% 45%" },
  "pingo-1": { desktop: "50% 50%", mobile: "50% 50%" },
  fresh32: { desktop: "49% 50%", mobile: "49% 50%" },
};
const CENTRED: AboutReelFilm["focalPoint"] = {
  desktop: "50% 50%",
  mobile: "50% 50%",
};

/**
 * The reel, in order. Slugs, not a second copy of the project data.
 *
 * A curated cut of the work rather than an inventory of it — four films, each
 * one a different kind of thing, so a visitor who watches the panel for a
 * minute has seen the range and not the same penguin three times:
 *
 *   otp       a branded commercial with actors, and the one AI-Hybrid piece
 *   schweppes a different aesthetic entirely — product, macro, performance
 *   pingo-1   the playful character work, and the most varied of the three
 *             Pingo films: orange studio, Ljubljana, the water slide
 *   fresh32   a fourth distinct look, close and graphic
 *
 * BOHINJ IS DELIBERATELY NOT HERE. It was tried — it is the obvious pick for
 * visual contrast — and it is the one active film that cannot work in this
 * panel: it is 1080x1920, and a portrait film in a 1.64:1 frame is cropped to
 * about a third of its height, which turns every shot into an unreadable band
 * of sunglasses or fabric. The contrast it would add is vertical, and this
 * panel has no vertical to give it. It stays whole on the homepage and in the
 * viewer, where it is framed for.
 *
 * pingo-3 was also considered and set aside: it ends on a packshot and then
 * black, so it would hand the next film a black frame to cut from.
 */
const REEL_ORDER = ["otp", "schweppes", "pingo-1", "fresh32"] as const;

/**
 * Resolved against the homepage's own project data rather than listed here
 * with paths, so the reel can never name a file the site does not ship and
 * never falls back to a preview cut. A slug that stops being an active
 * project simply drops out of the reel instead of breaking it.
 */
const reelFilms: AboutReelFilm[] = REEL_ORDER.flatMap((slug) => {
  const project = visibleProjects.find((entry) => entry.slug === slug);
  const src = project?.media?.fullVideo;
  if (!src) return [];
  return [{ slug, src, focalPoint: REEL_FRAMING[slug] ?? CENTRED }];
});

/**
 * First-frame stills, for the first paint only. The poster is the FIRST
 * film's own frame 0, so the crossfade onto the playing film lands on the
 * identical picture. Later films never show a poster: the reel cuts straight
 * from one loaded film to the next.
 */
const REEL_FIRST_FRAME: Record<string, { poster: string; lqip: string }> = {
  otp: {
    poster: "/media/about/otp-poster.jpg",
    lqip: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAHAAbAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgYGBwYHCEhISEhISckJygoKCcnJycoKCgrKyszMzMrKysoKCsrMDAzMzc5NzQ0MzQ5OTw8PEhIRUVUVFdnZ3z/xABkAAEBAQEAAAAAAAAAAAAAAAAGAwcCAQEBAAAAAAAAAAAAAAAAAAADBBAAAgEDBQADAQAAAAAAAAAAARECAwAhQVESMWGhwZFSEQACAgMBAQAAAAAAAAAAAAAAARExAhKhUiH/wAARCAAOABgDASIAAhEAAxEA/9oADAMBAAIRAxEAPwCka8KVNEjOgWuqtFSr8oh9tHRba3gjzgpRe9tacyQJMvs7PwXHSm2L9G9Suqggjt1jPt3/AC88U4l8mM+H7vrkf6l8WM5FOi9cP//Z",
  },
};

const firstFrame = reelFilms[0] ? REEL_FIRST_FRAME[reelFilms[0].slug] : undefined;

export const aboutReel: {
  films: readonly AboutReelFilm[];
  poster?: string;
  /** Inline ~24px data URI: the panel's base layer, painted with the
   *  document so the panel is never blank at any bandwidth. */
  lqip?: string;
  /** The first film's framing, for the still layers underneath. */
  focalPoint: AboutReelFilm["focalPoint"];
} = {
  films: reelFilms,
  poster: firstFrame?.poster,
  lqip: firstFrame?.lqip,
  focalPoint: reelFilms[0]?.focalPoint ?? CENTRED,
};
