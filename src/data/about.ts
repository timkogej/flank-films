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
} as const;

type FocalPoint = `${number}% ${number}%`;

export interface AboutReelFilm {
  slug: string;
  /** The project's full-film web derivative — never its homepage preview. */
  src: string;
  /** Per film: one shared crop cannot frame three different films. */
  focalPoint: { desktop: FocalPoint; mobile: FocalPoint };
}

/**
 * Framing per film, checked across each whole film in the ~1.4-1.8:1 desktop
 * panel and the 4:5 stacked one. The ski film's skier rides right of centre
 * in its opening shots; the other two are composed on centre.
 */
const REEL_FRAMING: Record<string, AboutReelFilm["focalPoint"]> = {
  "pingo-2": { desktop: "52% 50%", mobile: "55% 50%" },
  "pingo-1": { desktop: "50% 50%", mobile: "50% 50%" },
  "pingo-3": { desktop: "50% 50%", mobile: "50% 50%" },
};
const CENTRED: AboutReelFilm["focalPoint"] = {
  desktop: "50% 50%",
  mobile: "50% 50%",
};

/**
 * First-frame stills, for the first paint only. The poster is the first
 * film's own frame 0, so the crossfade onto the playing film lands on the
 * identical picture. Later films never show a poster: the reel cuts straight
 * from one loaded film to the next.
 */
const REEL_FIRST_FRAME: Record<string, { poster: string; lqip: string }> = {
  "pingo-2": {
    poster: "/media/about/pingo-2-poster.jpg",
    lqip: "data:image/jpeg;base64,/9j//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgMDA4MDhAQEBAQEBMSExQUFBMTExMUFBQVFRUZGRkVFRUUFBUVGBgZGRscGxoaGRocHB4eHiQkIiIqKiszMz7/xABuAAACAwEAAAAAAAAAAAAAAAABBQIEAwYBAAMBAAAAAAAAAAAAAAAAAAABAgQQAAEDAwMBCAMBAAAAAAAAAAECEQMABDEhUUESgWGSkaFxFBNC8FMiEQACAwEBAAAAAAAAAAAAAAABABEhAhJh/8AAEQgADgAYAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8Ae2/3SSBMfVq2HbXLgY76ZXtksTJldBSgAFBBCd+NT78cV20UaIktGkITsP3WsLiBNwUEsClQJz/ocpLEZ9K0730RURasDmfRBQiSKFABVGhgPyDdjsaPyrf+8XiFQgs4YAyUgs7KUAVAcB21bG+9XehOw8hU16lv/9k=",
  },
};

/**
 * The About reel: every active Pingo film, whole, in homepage order — the
 * large ski film (slot 01), then slot 06, then slot 07 — and round again.
 *
 * Read from the homepage's own project data rather than listed here, so the
 * reel can never name a file the site does not ship, never fall back to a
 * preview cut, and follows the homepage if its Pingo films ever change.
 */
const reelFilms: AboutReelFilm[] = visibleProjects.flatMap((project) => {
  const src = project.media?.fullVideo;
  if (project.title !== "Pingo" || !src) return [];
  return [
    {
      slug: project.slug,
      src,
      focalPoint: REEL_FRAMING[project.slug] ?? CENTRED,
    },
  ];
});

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
