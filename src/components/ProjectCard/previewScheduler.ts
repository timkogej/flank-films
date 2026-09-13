/**
 * Who is allowed to be playing right now.
 *
 * One module-level scheduler for the whole mosaic, because the decision is a
 * comparison between cards: on a phone only the best-placed one or two
 * previews may run, and that cannot be decided by a card on its own.
 *
 * Everything here is event-driven — one shared IntersectionObserver and one
 * visibilitychange listener. There is no scroll handler and nothing runs per
 * frame; recomputation is coalesced into a single rAF.
 */

/** A card counts as on screen once this much of it is visible. */
const VISIBLE_RATIO = 0.35;

/** Hysteresis: once playing, a card keeps playing down to this ratio, so a
 *  preview sitting exactly on the threshold cannot stutter on and off. */
const KEEP_RATIO = 0.2;

/** Concurrent previews where decoding is expensive and the viewport is small. */
const TOUCH_BUDGET = 2;

export interface PreviewEntry {
  /** Latest intersection ratio. Owned by this module. */
  ratio: number;
  /** Currently allowed to play. Owned by this module. */
  active: boolean;
  /** Config + capability say this may play from visibility alone. */
  eligible: boolean;
  /** Position in the mosaic. Ranks cards when their ratios tie — which is
   *  every card during the intro, when they are all still off screen. */
  order: number;
  /** May run during the intro prewarm, before it is anywhere near the
   *  viewport. Autoplay previews only. */
  prewarm: boolean;
  /** Called only when `active` actually changes. */
  onChange: (active: boolean) => void;
}

const entries = new Map<Element, PreviewEntry>();
let observer: IntersectionObserver | null = null;
let frame = 0;

/**
 * The homepage is mounted but parked one viewport below the screen, hidden
 * behind the intro curtain.
 *
 * Intersection is the right question during normal use and the wrong one here:
 * the cards are legitimately off screen, yet by the end of the intro they will
 * all be on it. Without this, the mosaic arrives static and switches on afterwards.
 * So this is a declared state, not a fudged bounding box — the observer keeps
 * reporting the truth and this flag says the truth is briefly not the point.
 */
let prewarming = false;

/**
 * The project viewer is open over the homepage.
 *
 * Purely a playback condition, and deliberately nothing more. It does not
 * touch `active`, so no card changes its visible layer, no mode is
 * reinterpreted and no state is lost — the mosaic underneath is exactly as it
 * was, simply not decoding. There is no reason to run four preview loops and a
 * full film at once behind a blurred overlay.
 *
 * This mirrors how a hidden tab is treated: stop the decoders, disturb no
 * pixels. See ProjectPreviewMedia, where `wantsVideo` and `wantsPlay` are kept
 * apart for exactly this reason.
 */
let viewerActive = false;

function touchDevice(): boolean {
  return !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function apply(): void {
  frame = 0;

  const hidden = document.visibilityState === "hidden";
  const candidates: PreviewEntry[] = [];
  for (const entry of entries.values()) {
    // A hidden tab still stops everything: prewarming is not a licence to
    // decode video nobody can see.
    if (hidden || !entry.eligible) continue;
    const onScreen = entry.ratio >= (entry.active ? KEEP_RATIO : VISIBLE_RATIO);
    if (onScreen || (prewarming && entry.prewarm)) candidates.push(entry);
  }

  let allowed: Set<PreviewEntry>;
  if (touchDevice()) {
    // Strongest presence in the viewport wins the budget. During the intro
    // every ratio is 0, so mosaic order decides — which on mobile is exactly
    // the reading order, and therefore the first cards the viewer will meet.
    candidates.sort((a, b) => b.ratio - a.ratio || a.order - b.order);
    allowed = new Set(candidates.slice(0, TOUCH_BUDGET));
  } else {
    // Desktop runs every eligible loop. Several films moving at once is the
    // intended language, not a performance mistake.
    allowed = new Set(candidates);
  }

  for (const entry of entries.values()) {
    const next = allowed.has(entry);
    if (next === entry.active) continue;
    entry.active = next;
    entry.onChange(next);
  }
}

function invalidate(): void {
  if (!frame) frame = requestAnimationFrame(apply);
}

function ensureObserver(): IntersectionObserver {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (records) => {
      for (const record of records) {
        const entry = entries.get(record.target);
        if (entry) entry.ratio = record.intersectionRatio;
      }
      invalidate();
    },
    // Enough steps to rank cards against each other, few enough to stay cheap.
    { threshold: [0, 0.2, 0.35, 0.5, 0.7, 0.9, 1] },
  );
  document.addEventListener("visibilitychange", invalidate);
  return observer;
}

/** Register one card. Returns its teardown. */
export function observePreview(
  element: Element,
  entry: PreviewEntry,
): () => void {
  entries.set(element, entry);
  ensureObserver().observe(element);

  return () => {
    observer?.unobserve(element);
    entries.delete(element);
    if (entries.size === 0 && observer) {
      observer.disconnect();
      observer = null;
      document.removeEventListener("visibilitychange", invalidate);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else {
      invalidate();
    }
  };
}

/** Re-run the decision after something other than intersection changed. */
export function refreshPreviews(): void {
  invalidate();
}

/**
 * Turn the intro prewarm window on or off.
 *
 * Called by the intro wrapper, which is the only thing that knows the homepage
 * is mounted-but-parked. Clearing it hands every card straight back to the
 * ordinary rules — there is no lingering bypass, and a card that is genuinely
 * off screen when the window closes is paused like any other.
 */
export function setPreviewPrewarm(on: boolean): void {
  if (prewarming === on) return;
  prewarming = on;
  invalidate();
}

/* ------------------------------------------------------------ stills first */

/**
 * Longest any preview video waits for the mosaic's stills. Only reached when
 * an image neither loads nor errors — a stalled request must not strand every
 * preview on the page.
 */
const STILLS_CAP_MS = 5000;

const pendingStills = new Set<HTMLImageElement>();
const stillWaiters = new Set<() => void>();
let stillCheck = 0;

function releaseIfSettled(): void {
  stillCheck = 0;
  if (pendingStills.size > 0) return;
  const ready = [...stillWaiters];
  stillWaiters.clear();
  for (const release of ready) release();
}

/**
 * Deferred by a task, not checked inline: every card in a commit registers its
 * still in the same effect pass, and the first card must not see a mosaic of
 * one and conclude everything has landed.
 */
function scheduleStillCheck(): void {
  if (!stillCheck) stillCheck = window.setTimeout(releaseIfSettled, 0);
}

/**
 * Count one card's still towards the mosaic's first composition. Returns its
 * teardown. `complete` and the listeners are read in the same task, so a load
 * cannot slip between them.
 */
export function trackStill(img: HTMLImageElement): () => void {
  if (img.complete) return () => {};
  pendingStills.add(img);
  const settle = () => {
    img.removeEventListener("load", settle);
    img.removeEventListener("error", settle);
    if (pendingStills.delete(img)) scheduleStillCheck();
  };
  img.addEventListener("load", settle);
  img.addEventListener("error", settle);
  return settle;
}

/**
 * Run `release` once every tracked still has loaded or failed.
 *
 * The per-card version of this rule — a card's video waits for its own still —
 * was not enough: the first stills to land released multi-megabyte preview
 * files that then starved the largest remaining stills of the same pipe, so on
 * a moderate connection the page rose with posters still missing. The stills
 * are one composition and the guarantee layer, so the video enhancement waits
 * for all of them. On a fast connection they settle in tens of milliseconds and
 * nothing about the prewarm changes; during the intro this is what makes the
 * extra time turn into posters on the page when it arrives.
 */
export function afterStills(release: () => void): () => void {
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    window.clearTimeout(cap);
    stillWaiters.delete(once);
    release();
  };
  const cap = window.setTimeout(once, STILLS_CAP_MS);
  stillWaiters.add(once);
  scheduleStillCheck();
  return () => {
    done = true;
    window.clearTimeout(cap);
    stillWaiters.delete(once);
  };
}

/** Whether a project film is currently open over the mosaic. */
export function isViewerActive(): boolean {
  return viewerActive;
}

/**
 * Open or close the viewer gate.
 *
 * Idempotent, and synchronous rather than rAF-coalesced: when a film is about
 * to start, the previews should already have stopped. Every registered card is
 * re-synced with its `active` value unchanged, because the thing that changed
 * is the gate, not the card.
 */
export function setViewerActive(on: boolean): void {
  if (viewerActive === on) return;
  viewerActive = on;
  for (const entry of entries.values()) entry.onChange(entry.active);
}
