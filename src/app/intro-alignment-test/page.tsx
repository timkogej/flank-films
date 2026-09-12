import type { Metadata } from "next";

import { AlignmentIntro } from "@/components/IntroAlignment/AlignmentIntro";
import { Header } from "@/components/Header/Header";
import { ProjectMosaic } from "@/components/ProjectMosaic/ProjectMosaic";
import { visibleProjects } from "@/data/projects";

import styles from "../page.module.css";

/**
 * DEVELOPMENT-ONLY visual test route for the ALIGNMENT LOCK prototype.
 *
 * Not linked from the header, the homepage, About or any project route, and
 * `noindex, nofollow` so it cannot be found from outside.
 *
 * The markup below is the homepage's own shell, its own header, its own
 * mosaic and its own stylesheet — the point of this route is to judge the
 * transition INTO the real page, so nothing here is a stand-in. The only
 * difference from `/` is which intro wrapper is around it.
 *
 * The production intro is untouched and still owns `/`. The Intro V2 video
 * prototype is untouched and still owns `/intro-v2-test`.
 */
export const metadata: Metadata = {
  title: "Alignment Lock prototype",
  robots: { index: false, follow: false },
};

export default function IntroAlignmentTestPage() {
  return (
    <AlignmentIntro>
      <div className={styles.shell}>
        <Header current="home" />
        <main className={styles.main}>
          <ProjectMosaic projects={visibleProjects} />
        </main>
      </div>
    </AlignmentIntro>
  );
}
