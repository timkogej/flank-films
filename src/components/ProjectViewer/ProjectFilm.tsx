"use client";

import { useEffect, useRef, useState } from "react";

import type { Project } from "@/data/projects";

import styles from "./ProjectViewer.module.css";

/**
 * The film itself, and the two layers that stand in for it until it can draw.
 *
 * The same order Phase 4.2 established for the mosaic, for the same reason:
 *
 *   0  inline LQIP   ships inside the HTML — no request to lose
 *   1  poster        the real still, eager and sync-decoded
 *   2  the film      fades in only once it can render a frame
 *
 * Nothing below is ever removed when something above arrives, so the viewer is
 * never an empty rectangle and never flashes black — not on a slow connection,
 * not before hydration, not if the film never loads at all.
 *
 * What is different from a preview: this box is the film's own shape, not an
 * art-directed frame. Every layer uses `object-fit: contain`. The mosaic
 * crops; the viewer never does.
 *
 * Keyed by slug from above, so switching project destroys this element rather
 * than repointing it. A discarded <video> that keeps its source keeps its
 * decoder and its buffer, which is exactly what §51 forbids.
 */
export function ProjectFilm({
  project,
  videoRef,
  ready,
  eager,
}: {
  project: Project;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** The film can draw a frame and may take over from the poster. */
  ready: boolean;
  /**
   * The film is going to start on its own, so fetch it properly. A film that
   * is waiting for someone to press play takes its metadata and no more —
   * which matters not at all for a ten-second development clip and matters
   * enormously for a ninety-second one.
   */
  eager: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const media = project.media;
  const src = media?.fullVideo;
  /** A still project's full-resolution artwork, if it has one. Never both:
   *  the film IS the work where there is one. */
  const stillSrc = src ? undefined : media?.fullImage;
  // Keyed by slug from above, so this cannot survive into another project and
  // needs no reset of its own.
  const [stillReady, setStillReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video || !src) return;

    // Only the project actually open asks for film bytes, and it asks once.
    //
    // The element ships with no `src`, so the preload scanner cannot start
    // pulling a film the moment the document parses — which is what keeps a
    // direct /work/[slug] load from racing its own poster, and what will keep
    // eight real films from ever being fetched together. Assigning the source
    // here IS the release: exactly one fetch, and nothing to abort.
    const release = () => {
      if (video.src) return;
      // `preload` has to be raised before the source is set: an element left
      // at "none" accepts a src and then does nothing with it.
      video.preload = eager ? "auto" : "metadata";
      video.src = src;
    };
    const still = root.querySelector("img");
    if (!still) release();
    else {
      still.addEventListener("load", release, { once: true });
      still.addEventListener("error", release, { once: true });
      // Close the same cached-image race as the homepage media stack: a poster
      // may settle between the first state check and listener registration.
      if (still.complete) release();
    }

    return () => {
      // Leave nothing decoding or downloading behind.
      video.pause();
      still?.removeEventListener("load", release);
      still?.removeEventListener("error", release);
      video.removeAttribute("src");
      video.load();
    };
  }, [src, eager, videoRef]);

  return (
    <div className={styles.filmMedia} ref={rootRef}>
      <div
        className={styles.filmPlaceholder}
        aria-hidden="true"
        style={
          media?.lqip
            ? ({ "--lqip": `url("${media.lqip}")` } as React.CSSProperties)
            : undefined
        }
      />

      {media?.poster && (
        // eslint-disable-next-line @next/next/no-img-element -- the film's own shape decides the box; nothing crops it.
        <img
          className={styles.filmLayer}
          src={media.poster}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="sync"
        />
      )}

      {/* Layer 2, for a project whose work is a still: the same artwork at
          viewer resolution, faded in over the card-sized poster once it can
          be painted. Only this project asks for it, and only while it is
          open. */}
      {stillSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- the artwork's own shape decides the box; nothing crops it.
        <img
          className={`${styles.filmLayer} ${styles.filmStill} ${
            stillReady ? styles.filmStillShown : ""
          }`}
          src={stillSrc}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onLoad={() => setStillReady(true)}
        />
      )}

      {src && (
        <video
          ref={videoRef}
          className={`${styles.filmLayer} ${styles.filmVideo} ${
            ready ? styles.filmVideoShown : ""
          }`}
          // A commercial is not wallpaper: it plays once and holds its last
          // frame. No `loop`, and never native chrome.
          playsInline
          preload="none"
          controls={false}
          disablePictureInPicture
          // The film is the page's subject; the dialog is already named for it.
          aria-hidden="true"
          tabIndex={-1}
        />
      )}
    </div>
  );
}
