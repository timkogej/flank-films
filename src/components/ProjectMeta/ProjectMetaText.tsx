import {
  META_SEPARATOR,
  projectCampaignLine,
  projectQualifiers,
  type Project,
} from "@/data/projects";

/**
 * The contents of a project's secondary line: "Push the limit · AI · (spec)".
 *
 * Shared by the mosaic card and the viewer so the two can never disagree. The
 * campaign carries the line; each qualifier — and the separator in front of it
 * — steps down into `noteClassName`, which keeps it out of the uppercasing and
 * one notch quieter. No wrapper element: the caller owns the line box.
 */
export function ProjectMetaText({
  project,
  noteClassName,
}: {
  project: Project;
  noteClassName: string;
}) {
  const campaign = projectCampaignLine(project);

  return (
    <>
      {campaign}
      {projectQualifiers(project).map((qualifier, index) => (
        <span key={qualifier} className={noteClassName}>
          {campaign || index > 0 ? META_SEPARATOR : null}
          {qualifier}
        </span>
      ))}
    </>
  );
}
