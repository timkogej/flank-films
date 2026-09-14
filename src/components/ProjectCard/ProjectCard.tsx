import Link from "next/link";
import type { CSSProperties } from "react";

import { ProjectMetaText } from "@/components/ProjectMeta/ProjectMetaText";
import { projectHref, projectMetaLine, type Project } from "@/data/projects";
import { PROJECT_VIEWER_ENABLED, SHOW_PLACEHOLDER_IDS } from "@/lib/site";

import { ProjectPreviewMedia } from "./ProjectPreviewMedia";
import styles from "./ProjectCard.module.css";

interface ProjectCardProps {
  project: Project;
  /** Index in the mosaic: the placeholder tone, and prewarm ranking. */
  index: number;
}

/**
 * A single mosaic frame.
 *
 * The frame owns its geometry and nothing inside can change it: the media
 * always fills it with `object-fit: cover` and is clipped by the rounded
 * container, so a 21:9 film and a square still sit in exactly the frames the
 * art direction assigned them. The grid never reacts to a source ratio.
 *
 * Three concerns are kept apart on purpose:
 *   this component   frame, hover/focus treatment, metadata, click semantics
 *   PreviewMedia     the still, the loop, readiness, play/pause
 *   previewScheduler which cards are allowed to be playing at all
 *
 * The hover treatment itself is pure CSS (`:hover` gated on a fine pointer,
 * plus `:focus-visible`), so the card ships no JavaScript of its own.
 */
export function ProjectCard({ project, index }: ProjectCardProps) {
  const { title, desktopFocalPoint, mobileFocalPoint, previewMode } = project;
  const metaLine = projectMetaLine(project);

  const style = {
    "--focal-desktop": desktopFocalPoint ?? "50% 50%",
    "--focal-mobile": mobileFocalPoint ?? desktopFocalPoint ?? "50% 50%",
    "--tone": `${4 + ((index * 3) % 7)}%`,
  } as CSSProperties;

  // A frame is a link to the work, or it is nothing. The mosaic never fakes
  // navigation with a click handler on a div: /work/[slug] is a real URL that
  // can be middle-clicked, copied, opened in a new tab and followed with
  // JavaScript disabled, and the interception that turns it into an overlay is
  // an enhancement on top of that, not the mechanism.
  const interactive = PROJECT_VIEWER_ENABLED;

  const contents = (
    <>
      <ProjectPreviewMedia project={project} order={index} />

      {/* Local, hover-only luminance drop — just enough to hold the type. The
          media is never dimmed at rest. */}
      <div className={styles.scrim} aria-hidden="true" />

      {/* Announced through the card's accessible name instead, so the same
          words are not read twice. */}
      <div className={styles.meta} aria-hidden="true">
        <span className={styles.metaTitle}>{title}</span>
        {metaLine && (
          <span className={styles.metaLine}>
            {/* Qualifiers, not a second title and not labels: they keep the
                campaign's line but step down out of its case and weight. */}
            <ProjectMetaText project={project} noteClassName={styles.metaNote} />
          </span>
        )}
      </div>

      {SHOW_PLACEHOLDER_IDS && (
        <span className={styles.placeholderId} aria-hidden="true">
          {project.id}
        </span>
      )}
    </>
  );

  const label = metaLine ? `${title}. ${metaLine}.` : title;

  if (!interactive) {
    // The viewer is switched off: there is nowhere to go, so the frame is not
    // a link. It stays keyboard-reachable, because the metadata that appears
    // on hover is the only thing it currently has to offer.
    return (
      <article
        className={styles.card}
        style={style}
        data-slot={project.id}
        data-preview={previewMode}
        tabIndex={0}
        aria-label={label}
        aria-roledescription="project preview"
      >
        {contents}
      </article>
    );
  }

  return (
    <Link
      href={projectHref(project)}
      className={styles.card}
      style={style}
      data-slot={project.id}
      data-preview={previewMode}
      data-project-slug={project.slug}
      data-project-name={project.title}
      data-project-position={index + 1}
      aria-label={label}
    >
      {contents}
    </Link>
  );
}
