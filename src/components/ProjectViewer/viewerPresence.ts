/**
 * Which viewer is on screen.
 *
 * Two can briefly want to be. Route interception applies to any client-side
 * navigation, so pressing Next — or swiping — while on a standalone
 * /work/[slug] page opens the INTERCEPTED route over it: the page that was
 * showing project 01 stays mounted in `children`, and a modal showing project
 * 03 renders above it. Two dialogs, two films, and the one underneath still
 * decoding.
 *
 * Rather than fight the router, the standalone viewer simply yields. When a
 * modal is up it renders nothing, which unmounts its film and releases it
 * through ProjectFilm's own teardown.
 *
 * The second flag answers a question the modal cannot otherwise ask: what is
 * behind me? A modal opened from the mosaic can go Back to it. A modal opened
 * over a standalone project cannot — that navigation was a `replace`, so there
 * is no portfolio in the history to return to, and Back would leave the site.
 * That one goes home instead.
 */

let modalOpen = false;
let standaloneMounted = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeViewerPresence(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isModalOpen(): boolean {
  return modalOpen;
}

/** Server render, and the first client render, always start from nothing open. */
export function modalClosedSnapshot(): boolean {
  return false;
}

export function setModalOpen(on: boolean): void {
  if (modalOpen === on) return;
  modalOpen = on;
  notify();
}

/** True while a standalone project page is the thing underneath. */
export function hasStandaloneViewer(): boolean {
  return standaloneMounted;
}

export function setStandaloneViewer(on: boolean): void {
  standaloneMounted = on;
}
