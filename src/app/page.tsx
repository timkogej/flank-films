import { DarkLightIntro } from "@/components/IntroDarkLight/DarkLightIntro";
import { Header } from "@/components/Header/Header";
import { ProjectMosaic } from "@/components/ProjectMosaic/ProjectMosaic";
import { visibleProjects } from "@/data/projects";
import { StructuredData } from "@/lib/structuredData";

import styles from "./page.module.css";

export default function HomePage() {
  return (
    <>
      <StructuredData page="home" />
      <DarkLightIntro>
        <div className={styles.shell}>
          <Header current="home" />
          <main className={styles.main}>
            <h1 className="sr-only">
              FLANK FILMS — Commercial production for agencies
            </h1>
            <ProjectMosaic projects={visibleProjects} />
          </main>
        </div>
      </DarkLightIntro>
    </>
  );
}
