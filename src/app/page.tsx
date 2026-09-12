import { DarkLightIntro } from "@/components/IntroDarkLight/DarkLightIntro";
import { Header } from "@/components/Header/Header";
import { ProjectMosaic } from "@/components/ProjectMosaic/ProjectMosaic";
import { visibleProjects } from "@/data/projects";

import styles from "./page.module.css";

export default function HomePage() {
  return (
    <DarkLightIntro>
      <div className={styles.shell}>
        <Header current="home" />
        <main className={styles.main}>
          <ProjectMosaic projects={visibleProjects} />
        </main>
      </div>
    </DarkLightIntro>
  );
}
