"use client";

import { useEffect, useRef } from "react";

import {
  afterStills,
  saveDataPreferred,
} from "@/components/ProjectCard/previewScheduler";
import {
  isModalOpen,
  subscribeViewerPresence,
} from "@/components/ProjectViewer/viewerPresence";

import {
  DEFAULT_BACKDROP,
  DEFAULT_BACKDROP_LQIP,
  useHomeBackdrop,
} from "./HomeBackdropContext";
import type { BackdropCapabilities } from "./homeBackdropController";
import styles from "./HomeBackdrop.module.css";

/**
 * The film behind the framed homepage.
 *
 *   base       the default's tone, its inline LQIP and its poster — painted
 *              with the document and never removed, so there is always a
 *              finished frame underneath
 *   layer × 2  the controller's front and standby; see
 *              homeBackdropController.ts for how media moves between them
 *
 * Decorative and nothing else: aria-hidden, not focusable, no controls, never
 * counted by the preview scheduler. It borrows only the scheduler's
 * `afterStills` gate — read, not changed — so no backdrop bytes compete with
 * the mosaic's posters.
 *
 * Capabilities, not widths:
 *   switching        by hover with (hover: hover) and (pointer: fine); by the
 *                    dominant card while scrolling everywhere else; never
 *                    under reduced motion
 *   video            never under reduced motion or Save-Data — the backdrop
 *                    then uses the cards' posters, already in the cache
 *
 * It is mounted inside the intro's riser, so it arrives WITH the page rather
 * than being uncovered by it: see the stylesheet for why that needs `top` and
 * `height` rather than `inset: 0`.
 */
export function HomeBackdrop() {
  const controller = useHomeBackdrop();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const [a, b] = rootRef.current?.querySelectorAll<HTMLElement>("[data-layer]") ?? [];
    if (!controller || !a || !b) return;
    const layer = (root: HTMLElement) => ({
      root,
      video: root.querySelector("video")!,
      image: root.querySelector("img")!,
    });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const capabilities = (): BackdropCapabilities => ({
      videoAllowed: !reducedMotion.matches && !saveDataPreferred(),
      mode: reducedMotion.matches
        ? "static"
        : finePointer.matches
          ? "hover"
          : "scroll",
    });

    controller.attach([layer(a), layer(b)], capabilities());

    const onCapability = () => controller.setCapabilities(capabilities());
    const onVisibility = () =>
      controller.setSuspended("hidden", document.visibilityState === "hidden");
    const onViewer = () => controller.setSuspended("viewer", isModalOpen());

    reducedMotion.addEventListener("change", onCapability);
    finePointer.addEventListener("change", onCapability);
    document.addEventListener("visibilitychange", onVisibility);
    const unsubscribe = subscribeViewerPresence(onViewer);
    onVisibility();
    onViewer();

    const cancelRelease = afterStills(() => controller.start());

    return () => {
      cancelRelease();
      unsubscribe();
      reducedMotion.removeEventListener("change", onCapability);
      finePointer.removeEventListener("change", onCapability);
      document.removeEventListener("visibilitychange", onVisibility);
      controller.detach();
    };
  }, [controller]);

  return (
    <div
      ref={rootRef}
      className={styles.backdrop}
      aria-hidden="true"
      style={
        DEFAULT_BACKDROP_LQIP
          ? ({ "--lqip": `url("${DEFAULT_BACKDROP_LQIP}")` } as React.CSSProperties)
          : undefined
      }
    >
      {DEFAULT_BACKDROP?.image && (
        // eslint-disable-next-line @next/next/no-img-element -- the same art-directed still the mosaic card uses; one URL, one cache entry.
        <img
          className={styles.media}
          src={DEFAULT_BACKDROP.image}
          alt=""
          loading="eager"
          decoding="async"
          style={{ objectPosition: DEFAULT_BACKDROP.position }}
        />
      )}
      {/* Roles and kinds are the controller's to set; React never renders
          this component again after mount, so it never overwrites them. */}
      {[0, 1].map((index) => (
        <div key={index} className={styles.layer} data-layer>
          <video
            className={styles.media}
            muted
            loop
            playsInline
            preload="none"
            tabIndex={-1}
            disablePictureInPicture
            disableRemotePlayback
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- a card poster at viewport size; filled in by the controller. */}
          <img className={styles.media} alt="" decoding="async" />
        </div>
      ))}
    </div>
  );
}
