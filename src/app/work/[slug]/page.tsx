import { notFound, redirect } from "next/navigation";

import { getProjectBySlug } from "@/data/projects";

/**
 * The standalone project route — currently not a public experience.
 *
 * FLANK ships without standalone Work pages for now. The project experience is
 * the homepage: click a frame, the film opens in the viewer over the mosaic,
 * Close returns to the work. Nothing links here, nothing advertises it, and it
 * is not something to land on.
 *
 * The segment itself has to stay. It is the route the `@modal` slot intercepts
 * — `@modal/(.)work/[slug]` cannot intercept a path that does not exist — and
 * it is the URL the viewer puts in the address bar as the visitor moves
 * through the work. Deleting this file would not remove a page; it would
 * remove the viewer.
 *
 * So the segment stays and the page goes. On a client-side navigation from the
 * mosaic this component never runs at all: the interception renders the
 * overlay beside the homepage, and the homepage stays in `children` untouched.
 * This runs only on the other path — a hard load, a refresh, a pasted link —
 * where there is no homepage behind the URL and no viewer to open. Those reach
 * the work the only way it is currently published: from the top.
 *
 * A 307 rather than a 308: the standalone pages are withheld for this launch,
 * not retired, and a permanent redirect is cached by browsers for a long time
 * after the day it stops being true.
 *
 * Restoring them is this file, and only this file — the viewer already renders
 * a standalone project, `mode="page"`, unchanged and still tested by nothing
 * else that had to be touched here.
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getProjectBySlug(slug)) notFound();

  redirect("/");
}
