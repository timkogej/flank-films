/**
 * Which one card owns the backdrop on a touch device.
 *
 * The preview scheduler already answers a different question — which one or
 * two cards may PLAY — and it only knows about cards that have a loop (Petrol
 * is a still and never registers) or that are eligible to move at all (none
 * are under reduced motion). The backdrop needs every card, and one winner
 * rather than a budget, so it asks separately — with the same instruments and
 * none of the scheduler's state: one IntersectionObserver on the same 5% steps,
 * one rAF-coalesced ranking pass, and `scrollend`. There is no scroll handler,
 * and it never touches playback.
 *
 * Ranking. The mosaic is under two viewports tall on a phone, so "what fills
 * the screen" cannot walk through it — the large frames would own everything.
 * Attention can: as in the scheduler, a focus line runs from near the top of
 * the viewport at the top of the page to near the bottom at the end, and the
 * card nearest it leads:
 *
 *   score = FOCUS × closeness of the card to the focus line
 *         + RATIO × share of the card on screen
 *         + COVERAGE × share of the screen it fills (saturating)
 *         + INCUMBENT if it already owns the backdrop
 *         + ATTENDED if it is the card the visitor last opened
 *
 * Closeness blends distance to the card's edge (zero while the line is inside
 * it) with distance to its centre, so a tall frame does not win just by being
 * tall. A card needs half of itself on screen to challenge and keeps its claim
 * down to a quarter — the scheduler's anti-flap band.
 *
 * Handing over. A challenger replaces the owner only when one of these holds:
 *
 *   - it has kept winning across TRAVEL_PX of scroll AND for DWELL_MS — so
 *     easing back and forth over a row boundary never swaps A → B → A, and a
 *     flick past four cards wins nothing on the way
 *   - the page has come to rest with it winning (`scrollend`, or REST_MS with
 *     no movement where the engine has no scrollend) — so a pause, or the end
 *     of the page, lands on the right card at once
 *
 * Nothing is chosen until the visitor has actually scrolled (or opened a
 * card): the page opens on the default.
 */

const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

const CHALLENGE_RATIO = 0.5;
const KEEP_RATIO = 0.25;

const FOCUS_WEIGHT = 0.65;
const RATIO_WEIGHT = 0.2;
const COVERAGE_WEIGHT = 0.15;
/** A card filling this share of the viewport counts as filling it. */
const COVERAGE_FULL = 0.45;
/** Edge distance vs. centre distance in closeness. */
const EDGE_MIX = 0.5;

const INCUMBENT_BONUS = 0.1;
const ATTENDED_BONUS = 0.2;

/** The focus line, as a share of viewport height, at the top and the end of
 *  the page; linear in between. */
const FOCUS_TOP = 0.2;
const FOCUS_BOTTOM = 0.9;

/** While moving, a challenger must keep winning over this much scroll... */
const TRAVEL_PX = 40;
/** ...and for this long. */
const DWELL_MS = 220;
/** No intersection change for this long counts as at rest. */
const REST_MS = 180;

/** Scroll distance that counts as the visitor having started to browse. */
const ENGAGE_PX = 48;

export interface DominanceOptions {
  /** The mosaic's frames, in DOM order. */
  cards: HTMLElement[];
  /** Send the settled winner. */
  onSelect: (card: HTMLElement) => void;
  /** Ranking is skipped while this is false (viewer, menu, hidden tab). */
  canRank: () => boolean;
  /** The element the menu and viewer mark `inert`. When they lift it the page
   *  may have moved underneath with no intersection change to say so, so the
   *  winner is settled again. */
  gateRoot: Element | null;
}

export class ScrollDominance {
  private observer: IntersectionObserver;
  private gateObserver: MutationObserver | null = null;
  private frame = 0;
  private gateFrame = 0;
  private restTimer = 0;
  private owner: HTMLElement | null = null;
  /** The challenger currently winning, and where and when it started to. */
  private pending: { card: HTMLElement; y: number; at: number } | null = null;
  private attended: HTMLElement | null = null;
  private engaged: boolean;
  private readonly startY: number;

  constructor(private readonly options: DominanceOptions) {
    this.startY = window.scrollY;
    // Arriving somewhere down the page (restored scroll on Back, or a return
    // from About) is already a position the visitor chose.
    this.engaged = window.scrollY > ENGAGE_PX;
    this.observer = new IntersectionObserver(this.invalidate, {
      threshold: THRESHOLDS,
    });
    for (const card of options.cards) this.observer.observe(card);
    window.addEventListener("scrollend", this.settle);
    document.addEventListener("visibilitychange", this.onGate);
    if (options.gateRoot) {
      this.gateObserver = new MutationObserver(this.onGate);
      this.gateObserver.observe(options.gateRoot, {
        attributes: true,
        attributeFilter: ["inert"],
      });
    }
  }

  dispose(): void {
    this.observer.disconnect();
    this.gateObserver?.disconnect();
    window.removeEventListener("scrollend", this.settle);
    document.removeEventListener("visibilitychange", this.onGate);
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.gateFrame);
    window.clearTimeout(this.restTimer);
  }

  /** A gate changed. Once it is open again, settle one frame later — after
   *  the menu or viewer has put the scroll offset back. */
  private onGate = () => {
    cancelAnimationFrame(this.gateFrame);
    this.gateFrame = requestAnimationFrame(() => {
      if (this.options.canRank()) this.settle();
    });
  };

  /** The visitor opened this card: it wins ties while it stays on screen, and
   *  a tap counts as having started to browse. */
  attend(card: HTMLElement): void {
    this.attended = card;
    this.engaged = true;
  }

  /**
   * Rank now and commit the winner without any hand-over wait — for moments
   * the page itself decides (the viewer closing). Returns the owner.
   */
  settleNow(): HTMLElement | null {
    this.settle();
    return this.owner;
  }

  private invalidate = () => {
    if (!this.frame) this.frame = requestAnimationFrame(this.apply);
  };

  /** The page is at rest: the current winner takes the backdrop. */
  private settle = () => {
    window.clearTimeout(this.restTimer);
    const winner = this.rank();
    if (winner) this.commit(winner);
  };

  private apply = () => {
    this.frame = 0;
    window.clearTimeout(this.restTimer);
    const winner = this.rank();
    if (!winner || winner === this.owner) {
      this.pending = null;
      return;
    }

    const y = window.scrollY;
    const now = performance.now();
    if (this.pending?.card !== winner) {
      this.pending = { card: winner, y, at: now };
    } else if (
      Math.abs(y - this.pending.y) >= TRAVEL_PX &&
      now - this.pending.at >= DWELL_MS
    ) {
      this.commit(winner);
      return;
    }
    // Observers fall silent when scrolling stops; that silence is the rest.
    this.restTimer = window.setTimeout(this.settle, REST_MS);
  };

  private commit(card: HTMLElement): void {
    this.pending = null;
    if (card === this.owner) return;
    this.owner = card;
    this.options.onSelect(card);
  }

  /** The strongest card now, or null when ranking is gated or not yet due.
   *  Reads at most eight boxes, only when an observer or a settle asked. */
  private rank(): HTMLElement | null {
    if (!this.options.canRank()) return null;
    if (!this.engaged) {
      if (Math.abs(window.scrollY - this.startY) < ENGAGE_PX) return null;
      this.engaged = true;
    }

    const viewport = window.innerHeight;
    const scrollable = document.documentElement.scrollHeight - viewport;
    const progress =
      scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    const focus = viewport * (FOCUS_TOP + (FOCUS_BOTTOM - FOCUS_TOP) * progress);

    let best: HTMLElement | null = null;
    let bestScore = -Infinity;
    for (const card of this.options.cards) {
      const box = card.getBoundingClientRect();
      if (box.height <= 0) continue;
      const visible = Math.max(
        0,
        Math.min(box.bottom, viewport) - Math.max(box.top, 0),
      );
      const ratio = visible / box.height;
      const isOwner = card === this.owner;
      if (this.attended === card && ratio < KEEP_RATIO) this.attended = null;
      if (ratio < (isOwner ? KEEP_RATIO : CHALLENGE_RATIO)) continue;

      const edge =
        focus < box.top ? box.top - focus : focus > box.bottom ? focus - box.bottom : 0;
      const centre = Math.abs(box.top + box.height / 2 - focus);
      const distance = EDGE_MIX * edge + (1 - EDGE_MIX) * centre;
      const closeness = 1 - Math.min(1, distance / viewport);
      const coverage = Math.min(1, visible / viewport / COVERAGE_FULL);
      const score =
        FOCUS_WEIGHT * closeness +
        RATIO_WEIGHT * ratio +
        COVERAGE_WEIGHT * coverage +
        (isOwner ? INCUMBENT_BONUS : 0) +
        (card === this.attended ? ATTENDED_BONUS : 0);
      // Ties go to the earlier frame, so a pair always resolves the same way.
      if (score > bestScore) {
        best = card;
        bestScore = score;
      }
    }
    return best;
  }
}
