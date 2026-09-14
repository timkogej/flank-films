"use client";

import { useEffect, useRef } from "react";

import type { Project } from "@/data/projects";

import {
  afterStills,
  isViewerActive,
  MOBILE_IDLE_RESET_MS,
  MOBILE_STALL_MS,
  MOBILE_STALL_RECOVERIES,
  observePreview,
  recallPosition,
  refreshPreviews,
  rememberPosition,
  reportPlayRefused,
  saveDataPreferred,
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
      near: false,
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
    //
    // Unlike wantsVideo(), this does not wait for a decoded frame. Asking only
    // after `loadeddata` made every start a relay — source, first frame, then
    // play() — so on an arrival each card began whenever its own decode
    // happened to finish. Asked as soon as the card is wanted, the browser
    // starts each loop the moment it can; the still covers the gap, and the
    // loop becomes the visible layer only once it has a frame.
    const wantsPlay = () =>
      !disposed &&
      !reducedMotion.matches &&
      Boolean(video!.src) &&
      (entry.active || (hovered && finePointer.matches && entry.ratio > 0)) &&
      document.visibilityState !== "hidden" &&
      !isViewerActive();

    let pointerPending = false; // a play() promise is outstanding
    let pointerRefused = false; // retried only when the element reports progress

    function sync() {
      if (!finePointer.matches) {
        syncTouch();
        return;
      }
      const play = wantsPlay();
      video!.classList.toggle(styles.videoShown, wantsVideo());

      if (play) {
        window.clearTimeout(resetTimer);
        // Fetch in full only once this card is actually wanted. On a phone
        // that keeps the intro from pulling every preview at once.
        if (video!.preload !== "auto") video!.preload = "auto";
        if (video!.paused && !pointerPending && !pointerRefused) {
          // Stated on the element at the moment of asking, as on touch.
          video!.muted = true;
          video!.playsInline = true;
          pointerPending = true;
          const started = video!.play();
          // Muted playback normally resolves, but Safari can still refuse.
          // Re-check afterwards: a fast pointer can leave before this settles,
          // and a late resolution must never win over newer intent (§32).
          if (started) {
            started
              .then(() => {
                pointerPending = false;
                if (!wantsPlay()) video!.pause();
              })
              .catch((error: unknown) => {
                pointerPending = false;
                // Interrupted by our own pause(): newer intent, not a failure.
                if (error instanceof DOMException && error.name === "AbortError") {
                  return;
                }
                // Asked again by the readiness events below — never a timer.
                if (wantsPlay()) pointerRefused = true;
              });
          } else {
            pointerPending = false;
          }
        }
        return;
      }

      pointerRefused = false;

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

    /* ---------------------------------------------------------- touch */

    // Without hover the card follows the scheduler's active set alone, and a
    // pause is only a pause: the loop keeps its place and its frame. Three
    // things differ from the pointer path above, each for a measured reason:
    //
    //  - play() is not gated on `loadeddata`. WebKit decodes no first frame
    //    for preload="metadata" until playback is asked for, so waiting for
    //    one first left every phone preview stuck at readyState 1.
    //  - the loop becomes the visible layer once frames are actually
    //    advancing, not when play() was requested — a buffering start keeps
    //    the still, and never flashes an empty element.
    //  - nothing rewinds until the card has been out of the set for
    //    MOBILE_IDLE_RESET_MS.
    let rendering = false; // an advancing frame has reached the video layer
    let playPending = false; // a play() promise is outstanding
    let playFailed = false; // the last play() was refused while wanted
    let idleTimer = 0;
    let stallTimer = 0;
    let stallBuffered = 0; // buffered seconds when the stall timer was armed
    let recoveries = 0;
    let playToken = 0; // only the latest play() may settle the flags
    let frameProbe = -1; // currentTime when playback was last requested
    let resumeAt = src ? recallPosition(src) : 0;

    const touchWantsPlay = () =>
      !disposed &&
      entry.active &&
      entry.eligible &&
      document.visibilityState !== "hidden" &&
      !isViewerActive();

    const bufferedEnd = () => {
      const ranges = video!.buffered;
      return ranges.length ? ranges.end(ranges.length - 1) : 0;
    };

    function clearStall() {
      window.clearTimeout(stallTimer);
      stallTimer = 0;
    }

    function armStall() {
      clearStall();
      stallBuffered = bufferedEnd();
      stallTimer = window.setTimeout(onStall, MOBILE_STALL_MS);
    }

    // One timer per start, not a poll: it only re-arms while bytes are still
    // arriving (a slow start, keep waiting) and gives up after a bounded
    // number of reloads (the still stays, which is always a valid card).
    function onStall() {
      stallTimer = 0;
      if (!touchWantsPlay() || video!.currentTime !== frameProbe) return;
      if (bufferedEnd() > stallBuffered) {
        armStall();
        return;
      }
      if (recoveries >= MOBILE_STALL_RECOVERIES) return;
      recoveries += 1;
      resumeAt = video!.currentTime || resumeAt;
      rendering = false;
      video!.classList.remove(styles.videoShown);
      playToken += 1; // the aborted request must not touch the new one
      playPending = false;
      video!.load();
      requestPlay();
    }

    function markRendering() {
      if (disposed || video!.paused || video!.readyState < 2) return;
      if (video!.currentTime === frameProbe) return;
      clearStall();
      recoveries = 0;
      if (rendering) return;
      rendering = true;
      syncTouch();
    }

    function requestPlay() {
      // `paused` turns false synchronously inside play(), so this is also the
      // guard against a second request while the first is settling.
      if (!video!.paused || playPending || !video!.src) return;
      // Silent and inline are what make the request legal on iOS; state them
      // on the element at the moment of asking rather than trusting markup.
      video!.muted = true;
      video!.defaultMuted = true;
      video!.playsInline = true;
      frameProbe = video!.currentTime;
      playPending = true;
      playFailed = false;
      const token = ++playToken;
      armStall();
      video!
        .play()
        .then(() => {
          if (token !== playToken) return;
          playPending = false;
          if (!touchWantsPlay()) video!.pause();
          else video!.requestVideoFrameCallback?.(() => markRendering());
        })
        .catch((error: unknown) => {
          if (token !== playToken) return;
          playPending = false;
          // Superseded by our own pause(): newer intent won, nothing failed.
          if (!touchWantsPlay()) return;
          // Retried by the readiness events below, or re-sync; never a timer.
          playFailed = true;
          // Only a gesture can change this answer.
          if (error instanceof DOMException && error.name === "NotAllowedError") {
            reportPlayRefused();
          }
        });
    }

    function idleReset() {
      idleTimer = 0;
      if (disposed || entry.active) return;
      rendering = false;
      video!.classList.remove(styles.videoShown);
      // Rewind under the still, once it has faded back over the top.
      idleTimer = window.setTimeout(() => {
        idleTimer = 0;
        if (!disposed && !entry.active && video!.currentTime !== 0) {
          video!.currentTime = 0;
        }
      }, FADE_MS);
    }

    function syncTouch() {
      // Buffer ahead for the cards that are about to matter, and only those.
      const buffer =
        entry.eligible &&
        (entry.active || (entry.near && !saveDataPreferred()));
      if (buffer && video!.src && video!.preload !== "auto") {
        video!.preload = "auto";
      }

      if (entry.active) {
        window.clearTimeout(idleTimer);
        idleTimer = 0;
      } else if (!idleTimer && (rendering || video!.currentTime > 0)) {
        idleTimer = window.setTimeout(idleReset, MOBILE_IDLE_RESET_MS);
      }

      // A paused loop keeps showing the frame it stopped on. Only reduced
      // motion and the idle reset hand the card back to its still.
      video!.classList.toggle(
        styles.videoShown,
        rendering && !reducedMotion.matches,
      );

      if (touchWantsPlay()) {
        requestPlay();
      } else {
        clearStall();
        if (!video!.paused) video!.pause();
      }
    }

    // Event-driven retry: a refused or premature play() is asked again when
    // the element reports it can now do more than when it was last asked.
    const onReadiness = () => {
      if (finePointer.matches) {
        if (!pointerRefused) return;
        pointerRefused = false;
        sync();
        return;
      }
      if (!playFailed) return;
      if (touchWantsPlay()) requestPlay();
    };
    const onLoadedMetadata = () => {
      // Continue where this preview was before the homepage unmounted.
      if (resumeAt > 0 && video.currentTime === 0 && resumeAt < video.duration) {
        video.currentTime = resumeAt;
      }
      resumeAt = 0;
      onReadiness();
    };
    const onTimeUpdate = () => {
      if (!finePointer.matches) markRendering();
    };

    const onLoadedData = () => {
      ready = true;
      if (finePointer.matches) pointerRefused = false;
      else onReadiness();
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
      // The card may already be in the active set, waiting only for bytes:
      // ask for playback in the same task as the source.
      sync();
    };
    const still = root.querySelector("img");
    const untrackStill = still ? trackStill(still) : () => {};
    const cancelRelease = afterStills(releaseVideo);

    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onReadiness);
    video.addEventListener("timeupdate", onTimeUpdate);
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
      window.clearTimeout(idleTimer);
      clearStall();
      if (src && rendering && video.currentTime > 0) {
        rememberPosition(src, video.currentTime);
      }
      unobserve();
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onReadiness);
      video.removeEventListener("timeupdate", onTimeUpdate);
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
