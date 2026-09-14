"use client";

import { createContext, useContext, useState } from "react";

import { getProjectBySlug, projectBackdrop } from "@/data/projects";

import { HomeBackdropController } from "./homeBackdropController";

/**
 * The default backdrop: the Ljubljana Pingo cut. Its warm stone and late
 * light read as colour against the white frames — the snow cut vanishes into
 * them — it is the smallest Pingo preview, and on desktop its card only plays
 * on hover, so no looping card beside it shows the same frames.
 */
const DEFAULT_SLUG = "pingo-3";

const defaultProject = getProjectBySlug(DEFAULT_SLUG);
export const DEFAULT_BACKDROP = defaultProject
  ? projectBackdrop(defaultProject)
  : undefined;
export const DEFAULT_BACKDROP_LQIP = defaultProject?.media?.lqip;

const HomeBackdropContext = createContext<HomeBackdropController | null>(null);

/**
 * One controller per homepage mount. Mounted inside the page, so leaving Home
 * discards it — no hover state can survive a route change — and arriving back
 * starts again from the default.
 */
export function HomeBackdropProvider({ children }: { children: React.ReactNode }) {
  const [controller] = useState(() => new HomeBackdropController(DEFAULT_BACKDROP));
  return (
    <HomeBackdropContext.Provider value={controller}>
      {children}
    </HomeBackdropContext.Provider>
  );
}

/** The homepage backdrop, or null anywhere it is not mounted. */
export function useHomeBackdrop(): HomeBackdropController | null {
  return useContext(HomeBackdropContext);
}
