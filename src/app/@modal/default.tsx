/**
 * No project is open.
 *
 * Rendered for the `@modal` slot on every route that is not an intercepted
 * project, and on any hard load — including a direct /work/[slug], which is
 * not a page for the moment and redirects to the homepage from `children`.
 */
export default function ModalDefault() {
  return null;
}
