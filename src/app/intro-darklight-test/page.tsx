import type { Metadata } from "next";

import { DarkLightIntro } from "@/components/IntroDarkLight/DarkLightIntro";
import { Header } from "@/components/Header/Header";
import { ProjectMosaic } from "@/components/ProjectMosaic/ProjectMosaic";
import { visibleProjects } from "@/data/projects";

import styles from "../page.module.css";

/**
 * DEVELOPMENT-ONLY regression route for the intro that now ships on `/`.
 *
 * Not linked from the header, the homepage, About or any project route, and
 * `noindex, nofollow` so it cannot be found from outside.
 *
 * It renders the SAME component, with the same single configuration, as the
 * homepage — the only difference is `controls`, which adds a development-only
 * replay/speed panel so the sequence can be watched repeatedly without
 * reloading. There is nothing on this route that can change what the intro
 * looks like, so it stays a faithful reference for `/` rather than drifting
 * into a separate variant.
 *
 * The superseded production intro (`src/components/Intro`) and the two earlier
 * prototypes (`IntroV2`, `IntroAlignment`) are all untouched and unreferenced
 * by `/`.
 */
export const metadata: Metadata = {
  title: "Intro regression",
  robots: { index: false, follow: false },
};

export default function IntroDarkLightTestPage() {
  return (
    <DarkLightIntro controls>
      <div className={styles.shell}>
        <Header current="home" />
        <main className={styles.main}>
          <ProjectMosaic projects={visibleProjects} />
        </main>
      </div>
    </DarkLightIntro>
  );
}
