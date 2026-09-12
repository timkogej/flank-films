import { ProjectCard } from "@/components/ProjectCard/ProjectCard";
import type { Project } from "@/data/projects";

import styles from "./ProjectMosaic.module.css";

interface ProjectMosaicProps {
  projects: readonly Project[];
}

/**
 * The eight-frame editorial mosaic.
 *
 * Placement is entirely CSS, keyed by each project's stable slot id rather
 * than its array position. Reordering or disabling data cannot silently shift
 * every later frame into the wrong geometry. No JS measures anything.
 */
export function ProjectMosaic({ projects }: ProjectMosaicProps) {
  return (
    <section className={styles.mosaic} aria-label="Selected work">
      {projects.map((project, index) => (
        <ProjectCard key={project.id} project={project} index={index} />
      ))}
    </section>
  );
}
