/**
 * Who is allowed to be playing right now.
 *
 * One module-level scheduler for the whole mosaic, because the decision is a
 * comparison between cards: on a phone only the best-placed one or two
 * previews may run, and that cannot be decided by a card on its own.
 *
 * Everything here is event-driven — one shared IntersectionObserver and one
 * visibilitychange listener. There is no scroll handler and nothing runs per
 * frame; recomputation is coalesced into a single rAF — except on arrival,
 * where a whole mosaic registering in one commit is decided in one microtask.
 */

/** A card counts as on screen once this much of it is visible. */
const VISIBLE_RATIO = 0.35;

/** Hysteresis: once playing, a card keeps playing down to this ratio, so a
 *  preview sitting exactly on the threshold cannot stutter on and off. */
const KEEP_RATIO = 0.2;

/* ------------------------------------------------------------ touch policy */

/*
 * Everything that decides playback on a touch device, in one place.
 *
 * Measured against the phone mosaic (360x800 to 430x932), where every frame
 * is shorter than the viewport and three or four of them are fully on screen
 * at once — so visibility alone cannot choose, and the ranking has to.
 */

/** Concurrent previews where decoding is expensive and the viewport is small. */
export const MOBILE_MAX_ACTIVE = 2;

/** With Save-Data on, one loop at most — never several files at once. */
const MOBILE_SAVE_DATA_MAX_ACTIVE = 1;

/** A card may join the active set once half of it is on screen... */
const MOBILE_ACTIVATE_RATIO = 0.5;

/** ...and keeps its place down to a quarter. The gap is the anti-flap band:
 *  on the measured grid it is 40-70px of scroll between start and stop. */
const MOBILE_DEACTIVATE_RATIO = 0.25;

/** Share of the score that is visibility; the rest is closeness to the focus
 *  line. */
const MOBILE_RATIO_WEIGHT = 0.6;

/** Score an active card gets for already playing. A challenger has to beat it
 *  by this much, so a tiny ranking advantage never swaps a running loop. */
const MOBILE_INCUMBENT_BONUS = 0.08;

/**
 * Where the eye is, as a fraction of viewport height, at the top and at the
 * bottom of the page; linear in between.
 *
 * A fixed centre line was simulated first and failed: at the bottom of every
 * phone layout the last frame (Schweppes) and the right-hand Pingo never won
 * a slot. A visitor who has scrolled to the end is looking at the end.
 */
const MOBILE_FOCUS_TOP = 0.2;
const MOBILE_FOCUS_BOTTOM = 0.9;

/** Near-viewport band in which a candidate may start buffering, not playing. */
const MOBILE_PREWARM_MARGIN = "25% 0px 25% 0px";

/**
 * How long a paused touch preview keeps its place. A short scroll away and
 * back resumes; past this the card returns to its still and rewinds.
 */
export const MOBILE_IDLE_RESET_MS = 25_000;

/**
 * A requested start that has neither advanced nor buffered anything for this
 * long is treated as stuck. WebKit can leave a preview at readyState 1,
 * `waiting`, with no further media event to react to; reloading the element
 * — keeping its position — is the one reliable way out.
 */
export const MOBILE_STALL_MS = 4_000;

/** Reloads a card may spend on one stuck start before settling on its still. */
export const MOBILE_STALL_RECOVERIES = 2;

export interface PreviewEntry {
  /** Latest intersection ratio. Owned by this module. */
  ratio: number;
  /** Currently allowed to play. Owned by this module. */
  active: boolean;
  /** Within the prewarm band. Owned by this module; touch only. */
  near: boolean;
  /** Config + capability say this may play from visibility alone. */
  eligible: boolean;
  /** Position in the mosaic. Ranks cards when their ratios tie — which is
   *  every card during the intro, when they are all still off screen. */
  order: number;
  /** May run during the intro prewarm, before it is anywhere near the
   *  viewport. Autoplay previews only. */
  prewarm: boolean;
  /** Called when `active` changes, and on touch when `near` does. */
  onChange: (active: boolean) => void;
}

const entries = new Map<Element, PreviewEntry>();
let observer: IntersectionObserver | null = null;
let nearObserver: IntersectionObserver | null = null;
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

/** The visitor asked to save data. Feature-detected; absent means no. */
export function saveDataPreferred(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return connection?.saveData === true;
}

/**
 * A card's box as laid out, ignoring transforms.
 *
 * Only used behind the intro, where the riser's transform parks the whole
 * mosaic a viewport down: the offset chain still reports where each frame
 * will be at rest, so the prewarm picks the cards that will actually be on
 * screen when the page arrives — and nothing has to switch as it lands.
 */
function layoutBox(element: HTMLElement): { top: number; height: number } {
  let top = 0;
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.offsetParent as HTMLElement | null
  ) {
    top += node.offsetTop;
  }
  return { top: top - window.scrollY, height: element.offsetHeight };
}

function applyTouch(): void {
  // A hidden tab and an open viewer pause through each card's own gate and
  // leave the set alone: flipping `active` here would start idle timers that
  // rewind the loops. Both re-rank the moment they end.
  if (document.visibilityState === "hidden" || viewerActive) return;

  const viewport = window.innerHeight;
  const scrollable = document.documentElement.scrollHeight - viewport;
  const progress =
    scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
  const focus =
    viewport *
    (MOBILE_FOCUS_TOP + (MOBILE_FOCUS_BOTTOM - MOBILE_FOCUS_TOP) * progress);

  const ranked: { entry: PreviewEntry; score: number }[] = [];
  for (const [element, entry] of entries) {
    if (!entry.eligible) continue;
    // Read here — at most eight boxes, once per frame, only when an observer
    // or scrollend asked — never from a scroll handler.
    const box = prewarming
      ? layoutBox(element as HTMLElement)
      : element.getBoundingClientRect();
    if (box.height <= 0) continue;
    const bottom = box.top + box.height;
    const ratio =
      Math.max(0, Math.min(bottom, viewport) - Math.max(box.top, 0)) /
      box.height;
    const threshold = entry.active
      ? MOBILE_DEACTIVATE_RATIO
      : MOBILE_ACTIVATE_RATIO;
    if (ratio < threshold) continue;

    const distance = Math.abs(box.top + box.height / 2 - focus);
    const proximity = 1 - Math.min(1, distance / viewport);
    ranked.push({
      entry,
      score:
        MOBILE_RATIO_WEIGHT * ratio +
        (1 - MOBILE_RATIO_WEIGHT) * proximity +
        (entry.active ? MOBILE_INCUMBENT_BONUS : 0),
    });
  }

  ranked.sort((a, b) => b.score - a.score || a.entry.order - b.entry.order);
  const budget = saveDataPreferred()
    ? MOBILE_SAVE_DATA_MAX_ACTIVE
    : MOBILE_MAX_ACTIVE;
  const allowed = new Set(ranked.slice(0, budget).map(({ entry }) => entry));

  // Stops before starts, so the budget holds even within this one pass.
  for (const next of [false, true]) {
    for (const entry of entries.values()) {
      if (allowed.has(entry) !== next || entry.active === next) continue;
      entry.active = next;
      entry.onChange(next);
    }
  }
}

function apply(): void {
  frame = 0;

  // Strongest presence near the focus line wins the budget; see applyTouch.
  if (touchDevice()) {
    applyTouch();
    return;
  }

  const hidden = document.visibilityState === "hidden";
  const candidates: PreviewEntry[] = [];
  for (const entry of entries.values()) {
    // A hidden tab still stops everything: prewarming is not a licence to
    // decode video nobody can see.
    if (hidden || !entry.eligible) continue;
    const onScreen = entry.ratio >= (entry.active ? KEEP_RATIO : VISIBLE_RATIO);
    if (onScreen || (prewarming && entry.prewarm)) candidates.push(entry);
  }

  // Desktop runs every eligible loop. Several films moving at once is the
  // intended language, not a performance mistake.
  const allowed = new Set(candidates);

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

let arrival = false;

/**
 * Decide now, not on the next frame, for cards that have just mounted.
 *
 * Registration used to wait for the IntersectionObserver's first delivery —
 * which comes only after the next rendering step — and then for a frame on
 * top of it. On a client-side arrival (About back to Home) that was a dead
 * stretch in which the cards were on screen, their stills were showing, and
 * no play() had been asked for. Every card in the commit registers in the
 * same effect pass, so one microtask after that pass decides the whole mosaic
 * together and issues every start in the same task.
 *
 * The observer stays the authority: its first record overwrites the measured
 * ratio, and hysteresis absorbs any disagreement between the two.
 */
function invalidateOnArrival(): void {
  if (arrival) return;
  arrival = true;
  queueMicrotask(() => {
    arrival = false;
    if (entries.size === 0) return;
    if (frame) cancelAnimationFrame(frame);
    apply();
  });
}

/** The ratio the observer will report, read once at registration. Ignores
 *  ancestor clipping, which the mosaic does not use. */
function measureRatio(element: Element): number {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return 0;
  const width = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
  const height =
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  return width > 0 && height > 0
    ? (width * height) / (rect.width * rect.height)
    : 0;
}

/**
 * Every 5%. Fine enough that on a phone some frame crosses a step every few
 * pixels of scroll, which keeps the touch ranking current without a scroll
 * handler. Includes both desktop thresholds, so desktop decisions are the
 * same crossings as before.
 */
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

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
    { threshold: THRESHOLDS },
  );
  nearObserver = new IntersectionObserver(
    (records) => {
      const touch = touchDevice();
      for (const record of records) {
        const entry = entries.get(record.target);
        if (!entry || entry.near === record.isIntersecting) continue;
        entry.near = record.isIntersecting;
        if (touch) entry.onChange(entry.active);
      }
    },
    { rootMargin: MOBILE_PREWARM_MARGIN },
  );
  document.addEventListener("visibilitychange", invalidate);
  // One settle pass per gesture: the observers report crossings during a
  // flick, this confirms the set once the page has come to rest.
  window.addEventListener("scrollend", invalidate);
  return observer;
}

/** Register one card. Returns its teardown. */
export function observePreview(
  element: Element,
  entry: PreviewEntry,
): () => void {
  entry.ratio = measureRatio(element);
  entries.set(element, entry);
  ensureObserver().observe(element);
  nearObserver?.observe(element);
  invalidateOnArrival();

  return () => {
    observer?.unobserve(element);
    nearObserver?.unobserve(element);
    entries.delete(element);
    if (entries.size === 0 && observer) {
      observer.disconnect();
      observer = null;
      nearObserver?.disconnect();
      nearObserver = null;
      disarmInteractionRetry();
      document.removeEventListener("visibilitychange", invalidate);
      window.removeEventListener("scrollend", invalidate);
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
 * Deferred, not checked inline: every card in a commit registers its still in
 * the same effect pass, and the first card must not see a mosaic of one and
 * conclude everything has landed. A microtask runs after that whole pass, and
 * unlike a timer task it cannot be clamped or queued behind other work — so on
 * an arrival whose stills are already cached, the videos are released in the
 * same task as the scheduler's decision.
 */
function scheduleStillCheck(): void {
  if (stillCheck) return;
  stillCheck = 1;
  queueMicrotask(releaseIfSettled);
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
  // The page may have moved under the viewer — it restores its scroll on the
  // way out — so re-rank as soon as it has, without waiting for a scroll.
  if (!on) invalidate();
}

/* ------------------------------------------------------ play() reliability */

/**
 * The first-interaction fallback.
 *
 * Muted inline playback is normally allowed without a gesture, but WebKit can
 * still refuse it (Low Power Mode on iOS is the usual case). When a card
 * reports a refused play() before the visitor has interacted, the next real
 * interaction gives every current candidate one more attempt. Armed only after
 * a refusal, removed by the first gesture that carries user activation.
 */
const RETRY_EVENTS = ["pointerdown", "touchstart", "touchend", "click"];
/** Gestures that grant activation: past one of these, another tap will not
 *  change the answer. */
const ACTIVATING_EVENTS = new Set(["touchend", "click"]);
let interactionArmed = false;

function onInteraction(event: Event): void {
  if (ACTIVATING_EVENTS.has(event.type)) disarmInteractionRetry();
  for (const entry of entries.values()) {
    if (entry.active) entry.onChange(true);
  }
}

function disarmInteractionRetry(): void {
  if (!interactionArmed) return;
  interactionArmed = false;
  for (const type of RETRY_EVENTS) {
    window.removeEventListener(type, onInteraction, true);
  }
}

/** A card's play() was refused for a reason readiness cannot fix. */
export function reportPlayRefused(): void {
  const activation = (
    navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
  ).userActivation;
  if (interactionArmed || activation?.hasBeenActive) return;
  interactionArmed = true;
  for (const type of RETRY_EVENTS) {
    window.addEventListener(type, onInteraction, {
      capture: true,
      passive: true,
    });
  }
}

/* ------------------------------------------------------- resume positions */

/**
 * Where each touch preview was when the homepage unmounted, so Home -> About
 * -> Home continues the loops rather than restarting them. One record per
 * preview file, and ignored once older than the idle reset — the same rule a
 * card that stayed mounted follows. Records are overwritten, never consumed,
 * so a development double-mount reads the same answer twice.
 */
const positions = new Map<string, { time: number; at: number }>();

export function rememberPosition(src: string, time: number): void {
  positions.set(src, { time, at: Date.now() });
}

export function recallPosition(src: string): number {
  const record = positions.get(src);
  if (!record || Date.now() - record.at > MOBILE_IDLE_RESET_MS) return 0;
  return record.time;
}
