"use client";

import { useEffect, useRef } from "react";

import type { Project } from "@/data/projects";

import {
  afterStills,
  isViewerActive,
  observePreview,
  refreshPreviews,
  trackStill,
} from "./previewScheduler";
import styles from "./ProjectCard.module.css";

/** Poster <-> preview crossfade. Must match --preview-fade in the stylesheet. */
const FADE_MS = 200;

/**
 * The media surface inside one mosaic frame.
 *
 * Three stacked layers in the same box, and the order is the whole point:
 *
 *   0  fallback surface   always there, unconditional
 *   1  the still          eager, above the fallback
 *   2  the preview loop   fades in only once it can render a frame
 *
 * Nothing below is ever removed when something above arrives. A card therefore
 * has valid content at every instant — before hydration, before the poster
 * decodes, before the video has a frame, and if any of those never happen. The
 * usual way these grids fail is treating the video as the content and the
 * still as a loading state; here the still is the content and the video is an
 * enhancement laid over it.
 *
 * There is deliberately NO React state here. Play/pause, readiness and the
 * crossfade are all driven imperatively through refs and one class toggle, so
 * a card that is playing, hovered and scrolling never re-renders. State would
 * buy nothing and cost eight components' worth of churn.
 */
export function ProjectPreviewMedia({
  project,
  order,
}: {
  project: Project;
  /** Position in the mosaic. Only used to rank prewarm candidates. */
  order: number;
}) {
  const { media, previewMode } = project;
  const lqip = media?.lqip;
  const poster = media?.poster;
  const src = previewMode === "still" ? undefined : media?.previewVideo;

  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video) return;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let ready = false; // the first frame is decodable
    let hovered = false;
    let disposed = false;
    let resetTimer = 0;

    // A hover preview on a device that cannot hover behaves like an autoplay
    // one: on a phone the alternative is a grid that never moves. Capability,
    // not width.
    const viewportDriven = () =>
      previewMode === "autoplay" ||
      (previewMode === "hover" && !finePointer.matches);

    const entry = {
      ratio: 0,
      active: false,
      eligible: !reducedMotion.matches && viewportDriven(),
      order,
      // Only autoplay previews may run behind the intro. A hover preview that
      // started on its own would destroy the mixed rhythm the mosaic depends
      // on — some films already moving, some waiting to be approached.
      prewarm: previewMode === "autoplay",
      onChange: () => sync(),
    };

    // Two separate questions, deliberately.
    //
    // "Should the loop be the visible layer?" is about intent — is this card
    // active, or hovered. "Should it be decoding?" adds the page's own state.
    // Keeping them apart means a tab switch pauses the decoder without
    // disturbing a single pixel: the frame the viewer left is still the frame
    // they come back to, with no crossfade to the still and back.
    const wantsVideo = () =>
      !disposed &&
      ready &&
      !reducedMotion.matches &&
      // Hover is additive: it shows regardless of the viewport budget, but
      // only while the card is genuinely on screen.
      (entry.active || (hovered && finePointer.matches && entry.ratio > 0));

    // The page's own state, on top of the card's intent. A hidden tab and an
    // open project viewer are the same kind of fact: nobody can see this loop,
    // so nothing should be decoding it. Neither one touches wantsVideo(), so
    // neither one moves a pixel — the frame the viewer left is the frame they
    // come back to.
    const wantsPlay = () =>
      wantsVideo() &&
      document.visibilityState !== "hidden" &&
      !isViewerActive();

    function sync() {
      const play = wantsPlay();
      video!.classList.toggle(styles.videoShown, wantsVideo());

      if (play) {
        window.clearTimeout(resetTimer);
        // Fetch in full only once this card is actually wanted. On a phone
        // that keeps the intro from pulling every preview at once.
        if (video!.preload !== "auto") video!.preload = "auto";
        if (video!.paused) {
          const started = video!.play();
          // Muted playback normally resolves, but Safari can still refuse.
          // Re-check afterwards: a fast pointer can leave before this settles,
          // and a late resolution must never win over newer intent (§32).
          if (started) {
            started
              .then(() => {
                if (!wantsPlay()) video!.pause();
              })
              .catch(() => {
                /* autoplay refused or interrupted by pause() — nothing to do */
              });
          }
        }
        return;
      }

      if (!video!.paused) video!.pause();
      // Rewind only after the still has finished fading back over the top, so
      // the reset itself is never visible.
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        if (!disposed && !wantsVideo() && video!.currentTime !== 0) {
          video!.currentTime = 0;
        }
      }, FADE_MS);
    }

    const onLoadedData = () => {
      ready = true;
      sync();
    };
    const onEnter = () => {
      hovered = true;
      if (!finePointer.matches) return;
      // Each fresh hover starts the curated loop from its first frame.
      if (!entry.active && video.currentTime !== 0) video.currentTime = 0;
      // Only fetch the file when the pointer actually asks for it.
      if (video.preload !== "auto") video.preload = "auto";
      sync();
    };
    const onLeave = () => {
      hovered = false;
      sync();
    };

    const onCapabilityChange = () => {
      entry.eligible = !reducedMotion.matches && viewportDriven();
      refreshPreviews();
      sync();
    };

    // Video bytes wait for the still.
    //
    // The element ships preload="none" so the preload scanner cannot start
    // fetching video the moment the document parses. On a slow connection that
    // was the actual failure: eight video files competing with eight posters
    // for the same pipe, and the posters — the layer that guarantees the card
    // is never empty — losing the race to the layer that is only an
    // enhancement. No card releases its video until every still in the
    // mosaic has landed (see afterStills), so the safety layer always wins —
    // including the largest stills, which a per-card rule left starved by the
    // videos the smaller ones had already released.
    //
    // On a fast connection the stills resolve in tens of milliseconds, so the
    // intro prewarm is unaffected.
    // Assigning src IS the release. The element ships without one, so the
    // preload scanner cannot start pulling video the moment the document
    // parses, and setting it here starts exactly one fetch.
    const releaseVideo = () => {
      if (disposed || video.src || !src) return;
      video.preload =
        previewMode === "autoplay" && finePointer.matches ? "auto" : "metadata";
      video.src = src;
    };
    const still = root.querySelector("img");
    const untrackStill = still ? trackStill(still) : () => {};
    const cancelRelease = afterStills(releaseVideo);

    video.addEventListener("loadeddata", onLoadedData);
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", onCapabilityChange);
    finePointer.addEventListener("change", onCapabilityChange);
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointercancel", onLeave);

    if (video.readyState >= 2) onLoadedData();
    const unobserve = observePreview(root, entry);

    return () => {
      disposed = true;
      window.clearTimeout(resetTimer);
      unobserve();
      video.removeEventListener("loadeddata", onLoadedData);
      document.removeEventListener("visibilitychange", sync);
      reducedMotion.removeEventListener("change", onCapabilityChange);
      finePointer.removeEventListener("change", onCapabilityChange);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointercancel", onLeave);
      cancelRelease();
      untrackStill();
      video.pause();
    };
  }, [previewMode, order, src]);

  return (
    <div className={styles.frame} ref={rootRef}>
      {/* Layer 0. Always rendered, never removed, never conditional. It ships
          inside the HTML, so it is painted with the document — no request to
          lose, nothing to defer, correct with JavaScript disabled. This is what
          the frame looks like if the poster 404s or the network stalls, which
          is why a card can never be an empty box. */}
      <div
        className={styles.placeholder}
        aria-hidden="true"
        style={
          lqip
            ? ({ "--lqip": `url("${lqip}")` } as React.CSSProperties)
            : undefined
        }
      />

      {/* Layer 1. The still.

          eager + high priority + sync decoding, deliberately. The mosaic spends
          the whole intro parked one viewport below the fold, so `loading=lazy`
          means the browser correctly decides these are off screen and defers
          them — and then they arrive DURING the rise. Eager puts all eight in
          the initial HTML for the preload scanner, and sync decoding means a
          fetched poster cannot be skipped by the paint that first reveals it.
          Eight small stills are one composition, not a feed. */}
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element -- media is art-directed and cropped by the frame, not by the image optimiser.
        <img
          className={styles.media}
          src={poster}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="sync"
        />
      )}

      {src && (
        <video
          ref={videoRef}
          className={`${styles.media} ${styles.video}`}
          // Homepage previews are ALWAYS silent surfaces: muted, no controls,
          // never fullscreen, never focusable.
          muted
          loop
          playsInline
          preload="none"
          tabIndex={-1}
          aria-hidden="true"
          disablePictureInPicture
        />
      )}
    </div>
  );
}
