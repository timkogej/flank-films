import { DarkLightIntro } from "@/components/IntroDarkLight/DarkLightIntro";
import { Header } from "@/components/Header/Header";
import { HomeBackdrop } from "@/components/HomeBackdrop/HomeBackdrop";
import { HomeBackdropProvider } from "@/components/HomeBackdrop/HomeBackdropContext";
import { ProjectMosaic } from "@/components/ProjectMosaic/ProjectMosaic";
import { visibleProjects } from "@/data/projects";
import { StructuredData } from "@/lib/structuredData";

import styles from "./page.module.css";

export default function HomePage() {
  return (
    <>
      <StructuredData page="home" />
      <DarkLightIntro>
        {/* The provider renders nothing: it lets the mosaic reach the
            backdrop controller, and is discarded with the page. */}
        <HomeBackdropProvider>
          {/* Before the shell and inside the intro's riser: the film arrives
              with the page. data-framed-shell switches on the framed tokens
              in globals.css, for this route only. */}
          <HomeBackdrop />
          <div className={styles.shell} data-framed-shell>
            <Header current="home" />
            <main className={styles.main}>
              <h1 className="sr-only">
                FLANK FILMS — Commercial production for agencies
              </h1>
              <ProjectMosaic projects={visibleProjects} />
            </main>
          </div>
        </HomeBackdropProvider>
      </DarkLightIntro>
    </>
  );
}
