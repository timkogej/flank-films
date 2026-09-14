/**
 * FLANK project model.
 *
 * Phase 7 real-media project data. Browser derivatives live separately from
 * archive masters under `public/media/projects`.
 *
 * The shape is deliberately complete so that dropping in real posters/loops
 * later is a DATA change only: no layout, component or grid rewrite.
 */

/** Where the media should stay anchored when the frame crops it. */
export type FocalPoint = `${number}% ${number}%`;

export type PreviewMode =
  /** Preview loops silently whenever it is substantially on screen. */
  | "autoplay"
  /** Rests on the still; the loop starts on hover (fine pointer) or, where
   *  there is no hover, on visibility like an autoplay preview. */
  | "hover"
  /** Still frame only. No <video> element is mounted at all. */
  | "still";

export type ProjectFormat =
  | "commercial"
  | "film"
  | "branded-content"
  | "music-video"
  | "social"
  | "photography";

export type ProductionMode =
  | "AI"
  | "AI-Edit"
  | "AI-Hybrid"
  | "AI-Hybrid · 3D animation";

export interface ProjectMedia {
  /**
   * A ~24px-wide inline data URI of the poster.
   *
   * The frame's base layer, and the reason a card can never be an empty box.
   * Because it lives in the HTML it needs no request and cannot lose a race:
   * it is painted with the document, at any bandwidth, before hydration, and
   * with JavaScript disabled entirely. Upscaled by `object-fit: cover` it
   * reads as a soft field of the right tone — enough that the frame looks
   * composed, and it is replaced by the real poster moments later.
   */
  lqip?: string;
  /** Still frame. Shown at rest and underneath the preview while it loads. */
  poster?: string;
  /** Short, silent, loop-friendly cut used inside the mosaic. */
  previewVideo?: string;
  /**
   * The full cut, played by the project viewer.
   *
   * Never requested by the mosaic. Only the project the viewer currently has
   * open asks for these bytes — see ProjectFilm.
   *
   * DEVELOPMENT FALLBACK: every entry below currently points at the same short
   * synthetic preview clip as `previewVideo`, because no real FLANK film
   * exists yet. Nothing in the player depends on that: a full cut may be any
   * length, any orientation, silent or not, and is never looped.
   *
   * A project may legitimately have NO film — project 03 is a photography
   * piece and carries none. The viewer renders it as a still.
   */
  fullVideo?: string;
  /**
   * The full-quality still, shown by the viewer for a project that has no
   * film.
   *
   * Never requested by the mosaic: a card is a small, cropped frame and
   * `poster` is already sized for it. This is the same artwork at viewer
   * resolution, and only the project the viewer currently has open asks for
   * it — see ProjectFilm, which layers it over the poster exactly the way a
   * film is layered over it.
   */
  fullImage?: string;
  /**
   * Intrinsic ratio of the source, e.g. 16 / 9.
   *
   * The mosaic ignores it (every frame crops). The viewer uses it to shape the
   * film box BEFORE any metadata has loaded, so the poster is already the
   * right shape; once the video reports `videoWidth`/`videoHeight` the real
   * ratio takes over. Both paths preserve the work — neither one crops it.
   */
  aspectRatio?: number;
}

export interface Project {
  id: string;
  slug: string;
  /** The public primary line: the brand, as the brand writes it. */
  title: string;
  /**
   * The public secondary line: the campaign or project this work is, in the
   * client's own words — never a category. A card that says "COMMERCIAL"
   * tells a visitor nothing they cannot already see.
   */
  campaign?: string;
  /**
   * How the work was made. Production metadata, not a badge: it follows the
   * campaign on the same line, one step down in size and opacity, and is
   * never uppercased with the rest of the line — so "AI-Hybrid" reads as
   * written.
   */
  productionMode?: ProductionMode;
  /** Speculative work, not a client commission. Shown as "(spec)", last. */
  spec?: boolean;
  /** Optional: not every client will be publicly nameable. */
  client?: string;
  year?: number;
  format?: ProjectFormat;
  media?: ProjectMedia;
  previewMode: PreviewMode;
  /** object-position for wide frames. */
  desktopFocalPoint?: FocalPoint;
  /** object-position for tall/narrow frames. */
  mobileFocalPoint?: FocalPoint;
  /**
   * object-position when this project is the full-viewport homepage backdrop.
   * Only the thin edges around the framed shell are ever seen, so this is
   * tuned for those edges, not for the hidden centre. Falls back to
   * `desktopFocalPoint`.
   */
  backdropFocalPoint?: FocalPoint;
  /** Set false to keep a slot in the data but out of the mosaic. */
  enabled?: boolean;
}

/** How the format enum reads in the hover line. */
export const projectFormatLabels: Record<ProjectFormat, string> = {
  commercial: "Commercial",
  film: "Film",
  "branded-content": "Branded content",
  "music-video": "Music video",
  social: "Social",
  photography: "Photography",
};

/** The separator between the parts of the secondary line. */
export const META_SEPARATOR = " · ";

/**
 * The leading, full-weight part of the secondary line: the campaign, or —
 * for a project without one — "Client · Commercial · 2026".
 */
export function projectCampaignLine(project: Project): string {
  if (project.campaign) return project.campaign;

  return [
    project.client,
    project.format ? projectFormatLabels[project.format] : undefined,
    project.year?.toString(),
  ]
    .filter(Boolean)
    .join(META_SEPARATOR);
}

/** The subordinate qualifiers that follow it, in order: mode, then spec. */
export function projectQualifiers(project: Project): string[] {
  const qualifiers: string[] = [];
  if (project.productionMode) qualifiers.push(project.productionMode);
  if (project.spec) qualifiers.push("(spec)");
  return qualifiers;
}

/**
 * The whole secondary line as plain text, e.g. "Push the limit · AI · (spec)".
 * Used wherever the line is announced or indexed rather than drawn. Optional
 * fields collapse cleanly — no dangling separators, and an empty result means
 * the component renders no second line at all.
 */
export function projectMetaLine(project: Project): string {
  return [projectCampaignLine(project), ...projectQualifiers(project)]
    .filter(Boolean)
    .join(META_SEPARATOR);
}

/**
 * Exactly eight slots — the desktop mosaic composition is built around this
 * count.
 *
 * The previewMode spread is DEVELOPMENT CONFIGURATION, chosen only so all
 * three behaviours are visible at once while the system is reviewed. It is
 * data, never derived from a card's position in the grid:
 *
 *   01 autoplay   02 hover   03 still   04 autoplay
 *   05 hover      06 autoplay   07 hover   08 autoplay
 *
 * `client` is deliberately absent everywhere: no real client may be invented,
 * and the metadata line has to be exercised in its collapsed form anyway.
 */
export const developmentProjects: Project[] = [
  {
    id: "01",
    slug: "project-01",
    title: "Project 01",
    year: 2026,
    format: "commercial",
    previewMode: "autoplay",
    media: {
      lqip:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAHAAbAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgQEBMQExYWFhYWFhoYGhsbGxoaGhobGxsdHR0iIiIdHR0bGx0dICAiIiUmJSMjIiMmJigoKDAwLi44ODpFRVP/xABVAAEBAQEAAAAAAAAAAAAAAAAHAgYEAQEAAAAAAAAAAAAAAAAAAAAAEAACAgMBAQAAAAAAAAAAAAACAQMABBEFEiERAQAAAAAAAAAAAAAAAAAAAAD/wAARCAAOABgDARIAAhIAAxIA/9oADAMBAAIRAxEAPwBgxyCANP5SnrZxxN+d0A1PVzREX5dBnmnkPToBU3UkI2O3eiPnDISLaoB//9k=",
      poster: "/dev-media/dev-poster-01.jpg",
      previewVideo: "/dev-media/dev-preview-01.mp4",
      // Development fallback — see ProjectMedia.fullVideo.
      fullVideo: "/dev-media/dev-preview-01.mp4",
      aspectRatio: 640 / 360,
    },
    desktopFocalPoint: "50% 50%",
    mobileFocalPoint: "50% 50%",
  },
  {
    id: "02",
    slug: "project-02",
    title: "Project 02",
    year: 2026,
    format: "music-video",
    previewMode: "hover",
    media: {
      lqip:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgQEBMQExYWFhYWFhoYGhsbGxoaGhobGxsdHR0iIiIdHR0bGx0dICAiIiUmJSMjIiMmJigoKDAwLi44ODpFRVP/xABYAAEAAwEBAAAAAAAAAAAAAAAEBgcCAQgBAQAAAAAAAAAAAAAAAAAAAAAQAAEEAwEBAAAAAAAAAAAAAAIBAAQRAwUxIRQRAQAAAAAAAAAAAAAAAAAAAAD/wAARCAAgABgDARIAAhIAAxIA/9oADAMBAAIRAxEAPwC1F14ClojyWyCuowAq5UjuDT5iFdKwCaFtRqrfm6RNMS6wBWfYmJdZihrl9RgHAlll8Vtwa4xXjAM/Eub2nbkCInlowD//2Q==",
      poster: "/dev-media/dev-poster-02.jpg",
      previewVideo: "/dev-media/dev-preview-02.mp4",
      fullVideo: "/dev-media/dev-preview-02.mp4",
      aspectRatio: 540 / 720,
    },
    desktopFocalPoint: "50% 45%",
    mobileFocalPoint: "50% 45%",
  },
  {
    id: "03",
    slug: "project-03",
    title: "Project 03",
    year: 2025,
    format: "photography",
    previewMode: "still",
    media: {
      lqip:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgQEBMQExYWFhYWFhoYGhsbGxoaGhobGxsdHR0iIiIdHR0bGx0dICAiIiUmJSMjIiMmJigoKDAwLi44ODpFRVP/xABQAAEBAQEAAAAAAAAAAAAAAAAEBgMHAQEAAAAAAAAAAAAAAAAAAAAAEAEBAQEAAAAAAAAAAAAAAAAAAgMREQEAAAAAAAAAAAAAAAAAAAAA/8AAEQgAGAAYAwESAAISAAMSAP/aAAwDAQACEQMRAD8A5xGagjMAGjNQRmADRmoIzAAozOgAIjM+ABtMcJAH/9k=",
      poster: "/dev-media/dev-poster-03.jpg",
      // No fullVideo on purpose: a photography project has no film, and the
      // viewer has to be correct for one.
      aspectRatio: 800 / 800,
    },
    desktopFocalPoint: "50% 50%",
    mobileFocalPoint: "50% 50%",
  },
  {
    id: "04",
    slug: "project-04",
    title: "Project 04",
    year: 2025,
    format: "film",
    previewMode: "autoplay",
    media: {
      lqip:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgABqwGQAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgQEBMQExYWFhYWFhoYGhsbGxoaGhobGxsdHR0iIiIdHR0bGx0dICAiIiUmJSMjIiMmJigoKDAwLi44ODpFRVP/xABYAAEBAQAAAAAAAAAAAAAAAAAHBgQBAQAAAAAAAAAAAAAAAAAAAAAQAAEEAgIDAQAAAAAAAAAAAAIBAwAEEQUhBmFRMRIRAQAAAAAAAAAAAAAAAAAAAAD/wAARCAAMABgDARIAAhIAAxIA/9oADAMBAAIRAxEAPwBmcIa7X5T1Jy+ZYWABvs7X3mQezcJTxmAGau2Vp5E8xC64w2RIqpzAD//Z",
      poster: "/dev-media/dev-poster-04.jpg",
      previewVideo: "/dev-media/dev-preview-04.mp4",
      fullVideo: "/dev-media/dev-preview-04.mp4",
      aspectRatio: 854 / 400,
    },
    desktopFocalPoint: "50% 50%",
    mobileFocalPoint: "50% 50%",
  },
  {
    id: "05",
    slug: "project-05",
    title: "Project 05",
    year: 2025,
    format: "branded-content",
    previewMode: "hover",
    media: {
      lqip:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAHAAbAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgQEBMQExYWFhYWFhoYGhsbGxoaGhobGxsdHR0iIiIdHR0bGx0dICAiIiUmJSMjIiMmJigoKDAwLi44ODpFRVP/xABXAAEBAQEAAAAAAAAAAAAAAAAHBgUIAQEAAAAAAAAAAAAAAAAAAAAAEAABBAMBAQEAAAAAAAAAAAABAgMAEQQFEpETIREBAAAAAAAAAAAAAAAAAAAAAP/AABEIAA4AGAMBEgACEgADEgD/2gAMAwEAAhEDEQA/ANbaYfd/JPkQMRxBbFpuAHL69fkNL6VYEfNmyl4GgEwAOcDaow6BP7Jd/V8q67gB/9k=",
      poster: "/dev-media/dev-poster-05.jpg",
      previewVideo: "/dev-media/dev-preview-05.mp4",
      fullVideo: "/dev-media/dev-preview-05.mp4",
      aspectRatio: 640 / 360,
    },
    desktopFocalPoint: "50% 50%",
    mobileFocalPoint: "50% 50%",
  },
  {
    id: "06",
    slug: "project-06",
    title: "Project 06",
    year: 2024,
    format: "commercial",
    previewMode: "autoplay",
    media: {
      lqip:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgQEBMQExYWFhYWFhoYGhsbGxoaGhobGxsdHR0iIiIdHR0bGx0dICAiIiUmJSMjIiMmJigoKDAwLi44ODpFRVP/xABYAAADAQEAAAAAAAAAAAAAAAAGBwQFAwEBAAAAAAAAAAAAAAAAAAAAABAAAQQDAQEBAAAAAAAAAAAAAQIABBEDBTISEyERAQAAAAAAAAAAAAAAAAAAAAD/wAARCAAYABgDARIAAhIAAxIA/9oADAMBAAIRAxEAPwBuiGnGLD45Z6Aki2AZ2Wf8Py2pdrJ9X5LALtjNGYGi1QjOtS6LADvYzVIUaLH9n0WASozGQaLz4XbADWPqyshQDP4XIYB//9k=",
      poster: "/dev-media/dev-poster-06.jpg",
      previewVideo: "/dev-media/dev-preview-06.mp4",
      fullVideo: "/dev-media/dev-preview-06.mp4",
      aspectRatio: 512 / 512,
    },
    desktopFocalPoint: "50% 50%",
    mobileFocalPoint: "50% 50%",
  },
  {
    id: "07",
    slug: "project-07",
    title: "Project 07",
    year: 2024,
    format: "social",
    previewMode: "hover",
    media: {
      lqip:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgQEBMQExYWFhYWFhoYGhsbGxoaGhobGxsdHR0iIiIdHR0bGx0dICAiIiUmJSMjIiMmJigoKDAwLi44ODpFRVP/xABXAAEBAQAAAAAAAAAAAAAAAAAHCAUBAQAAAAAAAAAAAAAAAAAAAAAQAAEEAgMBAQAAAAAAAAAAAAIAAREDBAUhEzESFBEBAAAAAAAAAAAAAAAAAAAAAP/AABEIACAAGAMBEgACEgADEgD/2gAMAwEAAhEDEQA/AMkdo9YxKPMysxeEALuFsuw+XRViEdfKAKi/ePxEqcj2ZM8SgBDyNZ2H4kzEcLeUAD9+seoPEy5lQE0IAkuzEPs8VBjq2N5hAH//2Q==",
      poster: "/dev-media/dev-poster-07.jpg",
      previewVideo: "/dev-media/dev-preview-07.mp4",
      fullVideo: "/dev-media/dev-preview-07.mp4",
      aspectRatio: 540 / 720,
    },
    desktopFocalPoint: "50% 40%",
    mobileFocalPoint: "50% 40%",
  },
  {
    id: "08",
    slug: "project-08",
    title: "Project 08",
    year: 2024,
    format: "commercial",
    previewMode: "autoplay",
    media: {
      lqip:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAFAAVAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgQEBMQExYWFhYWFhoYGhsbGxoaGhobGxsdHR0iIiIdHR0bGx0dICAiIiUmJSMjIiMmJigoKDAwLi44ODpFRVP/xABZAAEBAQAAAAAAAAAAAAAAAAAHBAYBAQAAAAAAAAAAAAAAAAAAAAAQAAEDBAIDAQAAAAAAAAAAAAEDAAIFBCGBEQZBNBMzEQEAAAAAAAAAAAAAAAAAAAAA/8AAEQgACgAYAwESAAISAAMSAP/aAAwDAQACEQMRAD8AYlE4oIkxxwHJeE/A58MAAanflVQwk8rfeztgCLR6cTIKRaH178dMA//Z",
      poster: "/dev-media/dev-poster-08.jpg",
      previewVideo: "/dev-media/dev-preview-08.mp4",
      fullVideo: "/dev-media/dev-preview-08.mp4",
      aspectRatio: 960 / 420,
    },
    desktopFocalPoint: "50% 50%",
    mobileFocalPoint: "50% 50%",
  },
];

/**
 * The eight approved homepage slots.
 *
 * The order IS the composition and IS the viewer's prev/next order. Slot ids
 * are the mosaic's placement keys — see ProjectMosaic.module.css, where every
 * breakpoint places each `data-slot` by id — so an id is a position in the
 * art direction, not a serial number.
 *
 *   01 Pingo, the tall anchor        05 Bohinj, the one portrait film
 *   02 Fresh 32 |                    06 Pingo |  the small pair
 *   03 Petrol   | the small pair     07 Pingo |
 *   04 Schweppes, the wide upper     08 OTP Banka, the wide closer
 *
 * Four previews autoplay (01, 05, 06, 08) and three wait to be approached
 * (02, 04, 07); 03 is a still and mounts no <video> at all. That balance is
 * unchanged from the seven-slot mapping — the closer autoplays because the
 * closer always did, not because a project was added.
 */
export const projects: Project[] = [
  {
    // The anchor. Three Pingo scenarios share one campaign line: they are one
    // campaign, and the scenario number is an internal fact, not a public name.
    id: "01",
    slug: "pingo-2",
    title: "Pingo",
    campaign: "Pingo Vitamin Water",
    productionMode: "AI",
    year: 2026,
    format: "commercial",
    previewMode: "autoplay",
    media: {
      lqip: "data:image/jpeg;base64,/9j//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgSEhUSFRgYGBgYGB0bHR4eHh0dHR0eHh4gICAmJiYgICAeHiAgJCQmJikqKScnJicqKi0tLTY2MzM/P0FNTV3/xABoAAACAwEAAAAAAAAAAAAAAAAEBgIBAwUBAQEAAAAAAAAAAAAAAAAAAAIEEAACAQIFBAMBAAAAAAAAAAABAhEDACEEQTESgVFhkSMFsdERAQADAQEBAQAAAAAAAAAAAAEhABECcSKB/8AAEQgADgAYAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8Af6ubAAKhTrvOHnsb4OazNRuKoGQEwxUEkHTEDAdLumC1NqggBepw2EbR3ssKr0YcBmmSfztpdPSPzPv7RxDsXLLFzRYVGkhmUHGTxO/n3hco8t7P9sr6hgr5qhxHxOGUxpVHKOhm32wKRWy7l//Z",
      poster: "/media/projects/pingo-2/poster.jpg",
      previewVideo: "/media/projects/pingo-2/preview.mp4",
      fullVideo: "/media/projects/pingo-2/full.mp4",
      aspectRatio: 16 / 9,
    },
    desktopFocalPoint: "50% 47%",
    mobileFocalPoint: "50% 48%",
  },
  {
    // Back in the small left-hand card it held before it was merged across the
    // whole 02 + 03 band.
    id: "02",
    slug: "fresh32",
    title: "Fresh 32",
    campaign: "Feel the freshness",
    productionMode: "AI",
    year: 2026,
    format: "commercial",
    previewMode: "hover",
    media: {
      lqip: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAHAAbAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgSEhUSFRgYGBgYGB0bHR4eHh0dHR0eHh4gICAmJiYgICAeHiAgJCQmJikqKScnJicqKi0tLTY2MzM/P0FNTV3/xABtAAEBAQEBAAAAAAAAAAAAAAADBQIEBgEBAQEAAAAAAAAAAAAAAAAABQIEEAACAQIEBAcBAAAAAAAAAAABAhEAAyEiURIEMTKRsdETcUHwYRQRAAICAgMBAAAAAAAAAAAAAAECABEDEpFhQRT/wAARCAAOABgDASIAAhEAAxEA/9oADAMBAAIRAxEAPwD3UqBLEKB8moaXxxFzYi5QOrzrvstnBOb7yA0rbkW7cKqqSRMCBiZrQ14yOYemFiQb9hnhnk9OHPGh/nbVe9I18xd/do8amet71f0N1FNan//Z",
      poster: "/media/projects/fresh32/poster.jpg",
      previewVideo: "/media/projects/fresh32/preview.mp4",
      fullVideo: "/media/projects/fresh32/full.mp4",
      aspectRatio: 16 / 9,
    },
    desktopFocalPoint: "49% 50%",
    mobileFocalPoint: "49% 50%",
  },
  {
    // A still project: no film, no <video> anywhere, and the viewer renders the
    // artwork rather than a player. The 3:2 billboard is cropped hard by this
    // portrait card, so the focal point is set left of centre — far enough to keep
    // the whole PETROL canopy sign, the model and the cup inside the frame.
    id: "03",
    slug: "petrol",
    title: "Petrol",
    campaign: "OOH Billboard",
    productionMode: "AI-Edit",
    year: 2026,
    format: "photography",
    previewMode: "still",
    media: {
      lqip: "data:image/jpeg;base64,/9j/2wBDAAgYGBwYHCEhISEhISckJygoKCcnJycoKCgrKyszMzMrKysoKCsrMDAzMzc5NzQ0MzQ5OTw8PEhIRUVUVFdnZ3z/xABuAAEBAQAAAAAAAAAAAAAAAAAGAQcBAQEBAQEAAAAAAAAAAAAAAAQDAQUCEAACAQQCAgMBAAAAAAAAAAABAhEDABIxIVEiYYGhE0ERAAEDBAIBBQEAAAAAAAAAAAEAEQIhMRJBA2GxkXGBE8Fy/8AAEQgAEAAYAwESAAISAAMSAP/aAAwDAQACEQMRAD8AlRVotgxTKJAY8XnNWu1Zi1TKoxG5UAfGJtkuTIUJCA7WQ4cWNSAfxd/6ZdJF+wbLyXxEwsfRFig4RCABkTv111cJPch/evl1UyehsshI2Bx/lo+GVBx41Bqk7g8Ex5akgcdyTqy1Ok1Z4ETE7/nq8D079F5lIAb6RDvbX2UoBpAn5X//2Q==",
      poster: "/media/projects/petrol/poster.jpg",
      fullImage: "/media/projects/petrol/still.jpg",
      aspectRatio: 10112 / 6784,
    },
    desktopFocalPoint: "45% 50%",
    mobileFocalPoint: "43% 50%",
  },
  {
    // The wide upper card. Preview is the source's own 5.17s -> 11.90s stretch:
    // bottle hero, macro, performance — cut to cut, so the loop lands as one more
    // edit and never on the end card.
    id: "04",
    slug: "schweppes",
    title: "Schweppes",
    campaign: "Just a sip away",
    productionMode: "AI",
    spec: true,
    year: 2026,
    format: "commercial",
    previewMode: "hover",
    media: {
      lqip: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAHAAbAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgYGBwYHCEhISEhISckJygoKCcnJycoKCgrKyszMzMrKysoKCsrMDAzMzc5NzQ0MzQ5OTw8PEhIRUVUVFdnZ3z/xABmAAADAQEAAAAAAAAAAAAAAAAFBAYCBwEBAQEAAAAAAAAAAAAAAAAABAAFEAEAAQMCBgMBAAAAAAAAAAABAgASAxEEIWFRQWKRgTHhExEAAgMBAQAAAAAAAAAAAAAAAQACEYExIf/AABEIAA4AGAMBIgACEQADEQD/2gAMAwEAAhEDEQA/AJPBjnudULfLt+tW2LbsW0lF6c3pRrbWsrCIRjxKI7nBEP6H2VmyxQQQ87cl8smmhKDb89w5Uprl8fVaYxjqgC8XSlrmq10fBXX/2Q==",
      poster: "/media/projects/schweppes/poster.jpg",
      previewVideo: "/media/projects/schweppes/preview.mp4",
      fullVideo: "/media/projects/schweppes/full.mp4",
      aspectRatio: 16 / 9,
    },
    desktopFocalPoint: "50% 45%",
    mobileFocalPoint: "50% 45%",
  },
  {
    // The only Bohinj. The 16:9 cut of the same spec is no longer an active
    // project — one film, one card, no duplicate.
    id: "05",
    slug: "bohinj-vertical",
    title: "Bohinj",
    campaign: "Push the limit",
    productionMode: "AI",
    spec: true,
    format: "commercial",
    previewMode: "autoplay",
    media: {
      lqip: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAPwBAAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgSEhUSFRgYGBgYGB0bHR4eHh0dHR0eHh4gICAmJiYgICAeHiAgJCQmJikqKScnJicqKi0tLTY2MzM/P0FNTV3/xAB8AAADAQEBAQAAAAAAAAAAAAAGBQcECAIDAQEBAQEAAAAAAAAAAAAAAAADBAUBEAACAAQEAgcJAQEAAAAAAAABAgARBAMhEjEFUROhQWFSIpFxBjMUsdHBkhVyU9IRAQACAQMFAQAAAAAAAAAAAAEAEQIhMQMTEnFhUUH/wAARCAAqABgDASIAAhEAAxEA/9oADAMBAAIRAxEAPwA23OuG32AwAZ3MkB07SewREP29cXzc9h2YZfxlLogk3uoWuYNZVmWmWVxsJAuwAAxxx4RPAoMsOmCxiVOiNnr23CyxcAOhAMsJg6GUGeWIv7OXMtTcB8Kcr18QYSxlhhOLfzbfeEEtO87Xqcv7fUiwKhSC3Ot5QOqczi0+EebVOXbKOGsK6brMPVYqZgyIi84xF/WD1ET4Q1oCtGrgjMX4S04cYd/F2/8ANvOBlahMq5mAJ+cffm2+8Iy3HXWVd8mNnAGGisG0IMYB1xjGsaplQSZxu5vv6ofXoI+sZc47o82/6h9U+4T+vsYGYDdfMeqn/9k=",
      poster: "/media/projects/bohinj-vertical/poster.jpg",
      previewVideo: "/media/projects/bohinj-vertical/preview.mp4",
      fullVideo: "/media/projects/bohinj-vertical/full.mp4",
      aspectRatio: 9 / 16,
    },
    desktopFocalPoint: "50% 45%",
    mobileFocalPoint: "50% 45%",
  },
  {
    id: "06",
    slug: "pingo-1",
    title: "Pingo",
    campaign: "Pingo Vitamin Water",
    productionMode: "AI",
    year: 2026,
    format: "commercial",
    previewMode: "autoplay",
    media: {
      lqip: "data:image/jpeg;base64,/9j//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgSEhUSFRgYGBgYGB0bHR4eHh0dHR0eHh4gICAmJiYgICAeHiAgJCQmJikqKScnJicqKi0tLTY2MzM/P0FNTV3/xABlAAADAQEAAAAAAAAAAAAAAAACAwUEBgEBAQEAAAAAAAAAAAAAAAAABgQFEAEAAQQCAwEBAQAAAAAAAAABAiEDEQASYTFRBBOBIhEAAgMAAwEAAAAAAAAAAAAAAQIDABIRYVFB/8AAEQgADgAYAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8A66BofTNskOILOSV6M+Mma4NQtwM22IlXlUwef7um3eLtr/Ua83HoClNLwxbIPyoppMkjrmoHlEUw1E7HFOqU0difHdlIvW2v5XZxH2MlNs7K65Zh4boRnSA3/9k=",
      poster: "/media/projects/pingo-1/poster.jpg",
      previewVideo: "/media/projects/pingo-1/preview.mp4",
      fullVideo: "/media/projects/pingo-1/full.mp4",
      aspectRatio: 16 / 9,
    },
    desktopFocalPoint: "50% 48%",
    mobileFocalPoint: "50% 50%",
  },
  {
    id: "07",
    slug: "pingo-3",
    title: "Pingo",
    campaign: "Pingo Vitamin Water",
    productionMode: "AI",
    year: 2026,
    format: "commercial",
    previewMode: "hover",
    media: {
      lqip: "data:image/jpeg;base64,/9j//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgSEhUSFRgYGBgYGB0bHR4eHh0dHR0eHh4gICAmJiYgICAeHiAgJCQmJikqKScnJicqKi0tLTY2MzM/P0FNTV3/xABrAAACAwEAAAAAAAAAAAAAAAAFBAMABwYBAQEAAAAAAAAAAAAAAAAAAAIEEAABAwIDBgcBAQAAAAAAAAABAhEDAAQxIRJB4TJhcaGi0YFRUiJTFBURAQEBAQEAAAAAAAAAAAAAAAEAEfBB/8AAEQgADgAYAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8AkkluklBQhaXLMUFiT5MaLS3ss0SiTqQs8LD6aMc+ZBUXf0oBci4EyJCtJCOHF/cliCO9PxxySxyrSpI1O4ILY5nrngzVHWe1tb6TJIQrQ7q5ukNmNjdK6T+pP5991ZqpUlnKMFDSxDnBmGzYwpj/AET8PFup48xU2//Z",
      poster: "/media/projects/pingo-3/poster.jpg",
      previewVideo: "/media/projects/pingo-3/preview.mp4",
      fullVideo: "/media/projects/pingo-3/full.mp4",
      aspectRatio: 16 / 9,
    },
    desktopFocalPoint: "50% 52%",
    mobileFocalPoint: "50% 51%",
    // The default backdrop, approved centred.
    backdropFocalPoint: "50% 50%",
  },
  {
    // The closer, in the wide bottom frame. Same film and same derivatives as
    // before — only the frame changed, and with it the crop: this card is nearly
    // twice as wide and much shorter, so the anchor moves up to hold the actors
    // and the logo inside it.
    id: "08",
    slug: "otp",
    title: "OTP Banka",
    campaign: "Pogumno je iti na zmago",
    // The one active project that is not plain AI.
    productionMode: "AI-Hybrid · 3D animation",
    year: 2026,
    format: "commercial",
    previewMode: "autoplay",
    media: {
      lqip: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAHAAbAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgSEhUSFRgYGBgYGB0bHR4eHh0dHR0eHh4gICAmJiYgICAeHiAgJCQmJikqKScnJicqKi0tLTY2MzM/P0FNTV3/xABsAAEBAQEAAAAAAAAAAAAAAAAGAgcDAQEBAQEBAAAAAAAAAAAAAAACBAEDBRAAAgEDBAEFAQAAAAAAAAAAARECMQMAEiFRQQSRgVJioTIRAAMAAgEFAQAAAAAAAAAAAAEAEUECAxMSYVExIf/AABEIAA4AGAMBIgACEgADEgD/2gAMAwEAAhEDEQA/ALj5MLFpEgkrYLvtHrbEdjyddsP+npkqRPqduK5hLIOoSI0xY2dMYWbhMYzMpGVS6M1yLXJVuLqR7y9icJlv6t7vlq7G2ifbkKrpnZj65nquQLEnFnkEPitMrXP5z/MzvZOn5S+uOWACfBH/2Q==",
      poster: "/media/projects/otp/poster.jpg",
      previewVideo: "/media/projects/otp/preview.mp4",
      fullVideo: "/media/projects/otp/full.mp4",
      aspectRatio: 16 / 9,
    },
    // Reviewed against the whole loop in the 948 x 344 frame, not inherited
    // from the old card: at 40% the otpbanka mark fell off the top edge and
    // the actor lost the top of his head on four of seven sampled beats. 26%
    // keeps the mark, the hedgehog and every head inside the frame.
    desktopFocalPoint: "50% 26%",
    // Phones put this card fourth, in the 21:9 frame, so it is cropped here
    // now where it used to be a true 16:9 and was not cropped at all. Checked
    // the same way, against seven beats of the loop in that frame: 26% clipped
    // the top of the actor's head on three of them, 0% held every head but
    // pinned the picture hard to its ceiling. 12% keeps every head and the
    // otpbanka mark inside the frame with the composition still breathing.
    // Only phones read this — see ProjectCard.module.css, where --focal-mobile
    // is scoped to the same 699px breakpoint the reorder is.
    mobileFocalPoint: "50% 12%",
  },
];

/**
 * The projects the site actually shows, in order.
 *
 * `enabled: false` keeps a slot in the data but out of the mosaic, out of the
 * routes, and out of previous/next. Everything downstream reads this list
 * rather than `projects`, so disabling a project is a one-word change.
 */
export const visibleProjects: readonly Project[] = projects.filter(
  (project) => project.enabled !== false,
);

/** Resolve a URL slug. `undefined` means 404 — never a fallback project. */
export function getProjectBySlug(slug: string): Project | undefined {
  return visibleProjects.find((project) => project.slug === slug);
}

/**
 * The projects either side of one, wrapping at both ends: the last project's
 * next is the first, and the first project's previous is the last. Order comes
 * from the array, never from an id — renumbering the work must not renumber
 * the navigation.
 *
 * A single visible project is its own neighbour on both sides, which is why
 * the caller compares slugs rather than assuming there are two of them.
 */
export function getAdjacentProjects(slug: string): {
  previous: Project | undefined;
  next: Project | undefined;
} {
  const index = visibleProjects.findIndex((project) => project.slug === slug);
  if (index < 0) return { previous: undefined, next: undefined };

  const count = visibleProjects.length;
  return {
    previous: visibleProjects[(index - 1 + count) % count],
    next: visibleProjects[(index + 1) % count],
  };
}

/** The canonical URL of a project. The one place the /work prefix is written. */
export function projectHref(project: Project): string {
  return `/work/${project.slug}`;
}

/** What the homepage backdrop needs to show one project. */
export interface ProjectBackdrop {
  /** Identity: the same key is never re-requested or re-faded. */
  key: string;
  /** The loop, when the project has one. */
  video?: string;
  /** The still: the whole backdrop for a still project, the fallback for the
   *  rest. Always the card's own poster, so it is already in the cache. */
  image?: string;
  position: string;
}

/**
 * A project as backdrop media, derived from the same fields the card uses —
 * so a new project, a reorder or a changed source needs no second mapping.
 */
export function projectBackdrop(project: Project): ProjectBackdrop {
  const { media } = project;
  return {
    key: project.slug,
    video: project.previewMode === "still" ? undefined : media?.previewVideo,
    image: media?.poster,
    position:
      project.backdropFocalPoint ?? project.desktopFocalPoint ?? "50% 50%",
  };
}

/** Resolve a card's slot id — the attribute every mosaic frame carries. */
export function getProjectBySlot(slot: string): Project | undefined {
  return visibleProjects.find((project) => project.id === slot);
}
