"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import { useHomeBackdrop } from "@/components/HomeBackdrop/HomeBackdropContext";
import type { BackdropMode } from "@/components/HomeBackdrop/homeBackdropController";
import { ScrollDominance } from "@/components/HomeBackdrop/scrollDominance";
import { useIntroRunning } from "@/components/IntroDarkLight/DarkLightIntro";
import {
  isModalOpen,
  subscribeViewerPresence,
} from "@/components/ProjectViewer/viewerPresence";
import { getProjectBySlot, projectBackdrop } from "@/data/projects";
import { SITE_ROOT_ID } from "@/lib/site";

const CARD = "[data-slot]";

function cardOf(node: EventTarget | null): HTMLElement | null {
  return node instanceof Element ? node.closest<HTMLElement>(CARD) : null;
}

function backdropFor(card: HTMLElement | null) {
  const project = card?.dataset.slot ? getProjectBySlot(card.dataset.slot) : undefined;
  return project ? projectBackdrop(project) : null;
}

/**
 * The mosaic's <section>, as the one place cards tell the homepage backdrop
 * they are being looked at.
 *
 * Delegated rather than per card: the cards stay server components, and the
 * preview system inside them is not touched at all. Each frame already
 * carries its slot id, and project data does the rest.
 *
 * The controller decides which input may speak (its `mode`), and only that
 * one is wired up:
 *
 *   hover    mouse and pen only — a touch never pretends to be a hover.
 *            Keyboard focus that is :focus-visible does the same, so tabbing
 *            through the work reads the same as pointing at it
 *   scroll   touch-first devices: the dominant card while scrolling, chosen by
 *            ScrollDominance. Its observer exists only in this mode, so a
 *            desktop runs none of it
 *   static   reduced motion: nothing is sent
 *
 * The background is decorative and is never announced. Nothing is sent while
 * the intro is still running.
 */
export function MosaicSection({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const backdrop = useHomeBackdrop();
  const introRunning = useIntroRunning();
  const ref = useRef<HTMLElement>(null);
  const dominance = useRef<ScrollDominance | null>(null);

  const subscribeMode = useCallback(
    (listener: () => void) => backdrop?.subscribeMode(listener) ?? (() => {}),
    [backdrop],
  );
  const mode = useSyncExternalStore<BackdropMode>(
    subscribeMode,
    () => backdrop?.mode ?? "static",
    () => "static",
  );

  // Closing the viewer. Hover: whatever is under the pointer now decides — it
  // did not move while the film was open, so no event will say so. Scroll: the
  // dominant card at the restored position decides, read a frame later, once
  // the viewer has unpinned the page and put its scroll offset back.
  useEffect(() => {
    if (!backdrop) return;
    let wasOpen = isModalOpen();
    let frame = 0;
    const unsubscribe = subscribeViewerPresence(() => {
      const open = isModalOpen();
      if (wasOpen && !open) {
        if (backdrop.mode === "scroll") {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            if (!dominance.current) return;
            backdrop.resolve(backdropFor(dominance.current.settleNow()));
          });
        } else {
          backdrop.resolve(
            backdropFor(
              ref.current?.querySelector<HTMLElement>(`${CARD}:hover`) ?? null,
            ),
          );
        }
      }
      wasOpen = open;
    });
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [backdrop]);

  // Scroll mode: one selector for the life of this mosaic, after the intro.
  useEffect(() => {
    const section = ref.current;
    if (!backdrop || !section || mode !== "scroll" || introRunning) return;
    const selector = new ScrollDominance({
      cards: [...section.querySelectorAll<HTMLElement>(CARD)],
      // The menu and the viewer both pin the page and mark the site inert:
      // scroll offsets read as zero underneath them, so nothing is ranked.
      canRank: () =>
        document.visibilityState !== "hidden" &&
        !isModalOpen() &&
        !section.closest("[inert]"),
      gateRoot: document.getElementById(SITE_ROOT_ID),
      onSelect: (card) => {
        const media = backdropFor(card);
        if (media) backdrop.select(media);
      },
    });
    dominance.current = selector;
    return () => {
      selector.dispose();
      if (dominance.current === selector) dominance.current = null;
    };
  }, [backdrop, mode, introRunning]);

  const enabled = Boolean(backdrop) && !introRunning && mode === "hover";

  // Engines re-run hit testing when the page moves under a resting cursor —
  // the intro's rise settling is exactly that — and report it as a pointer
  // entering a card. That is not someone looking at the work, so a card only
  // speaks once the pointer has genuinely moved over the settled page.
  const moved = useRef(false);
  const lastCard = useRef<HTMLElement | null>(null);

  const enter = (card: HTMLElement | null) => {
    if (!card || card === lastCard.current) return;
    lastCard.current = card;
    const media = backdropFor(card);
    if (media) backdrop!.hover(media);
  };

  return (
    <section
      ref={ref}
      className={className}
      aria-label="Selected work"
      onClick={(event) => {
        // Opening a card is the clearest statement of attention there is.
        const card = cardOf(event.target);
        if (card) dominance.current?.attend(card);
      }}
      onPointerMove={(event) => {
        if (!enabled || event.pointerType === "touch") return;
        moved.current = true;
        enter(cardOf(event.target));
      }}
      onPointerOver={(event) => {
        if (!enabled || !moved.current || event.pointerType === "touch") return;
        enter(cardOf(event.target));
      }}
      onPointerOut={(event) => {
        if (!enabled || event.pointerType === "touch") return;
        const card = cardOf(event.target);
        if (card && card !== cardOf(event.relatedTarget)) {
          lastCard.current = null;
          backdrop!.leave();
        }
      }}
      onFocus={(event) => {
        if (!enabled) return;
        const card = cardOf(event.target);
        if (card === event.target && card.matches(":focus-visible")) {
          lastCard.current = null;
          enter(card);
        }
      }}
      onBlur={(event) => {
        if (!enabled) return;
        if (cardOf(event.target) === event.target) {
          lastCard.current = null;
          backdrop!.leave();
        }
      }}
    >
      {children}
    </section>
  );
}
