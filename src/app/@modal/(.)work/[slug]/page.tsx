import { notFound } from "next/navigation";

import { ProjectViewer } from "@/components/ProjectViewer/ProjectViewer";
import { getProjectBySlug, visibleProjects } from "@/data/projects";

/** The overlay is prerendered for the same seven slugs as the page it
 *  intercepts, so opening a project is a static payload, not a render. */
export function generateStaticParams() {
  return visibleProjects.map((project) => ({ slug: project.slug }));
}

/**
 * The intercepted project route.
 *
 * Reached only by a client-side navigation from somewhere already on the site
 * — in practice, clicking a frame in the mosaic. The page underneath stays
 * exactly where it was in `children`; this renders beside it, over it.
 *
 * The same viewer, the same data, the same controls as the standalone route.
 * Only `mode` differs, and it decides four things: what is behind the film,
 * whether the film starts on its own, where Close goes, and whether there is a
 * page underneath that has to be made inert.
 */
export default async function InterceptedProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  return <ProjectViewer project={project} mode="modal" />;
}
