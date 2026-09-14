import { ProjectCard } from "@/components/ProjectCard/ProjectCard";
import type { Project } from "@/data/projects";

import { MosaicSection } from "./MosaicSection";

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
 *
 * The section itself is a thin client wrapper that tells the homepage
 * backdrop which card is being looked at; the cards stay server components.
 */
export function ProjectMosaic({ projects }: ProjectMosaicProps) {
  return (
    <MosaicSection className={styles.mosaic}>
      {projects.map((project, index) => (
        <ProjectCard key={project.id} project={project} index={index} />
      ))}
    </MosaicSection>
  );
}
