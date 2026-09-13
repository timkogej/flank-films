"use client";

import { useEffect, useRef } from "react";

import { aboutReel, type AboutReelFilm } from "@/data/about";

import styles from "./VisualPanel.module.css";

/** The panel counts as on screen at this much visibility, and keeps playing
 *  down to half of it so a panel resting on the line cannot stutter. */
const VISIBLE_RATIO = 0.3;
const KEEP_RATIO = 0.15;

/** HTMLMediaElement.HAVE_CURRENT_DATA: a frame exists and can be shown. */
const HAS_FRAME = 2;

/**
 * The About reel: four curated films, whole, one after another, forever.
 * OTP, Schweppes, Pingo and Fresh 32 — see REEL_ORDER in data/about.
 *
 * Not a project card and deliberately not built from one: no controls, no
 * overlay, no title, no hover, no click target, and none of the homepage's
 * scheduling policy. One panel with no competition owns its own observer.
 *
 * Two <video> elements, never more, and never both playing:
 *   front    — the film on screen.
 *   standby  — invisible, holding the NEXT film, loaded and parked on its
 *              first frame while the front one plays.
 * When the front film ends the standby is simply made visible and started —
 * a hard cut, the same cut an edit would make. If the next film is somehow
 * not ready yet, the front film holds its last frame until it is: never a
 * black frame, never the poster, never a spinner. The element that just went
 * out of view is then loaded with the film after that, so the pair leapfrogs
 * through the list and memory stays at two decoders.
 *
 * The poster and the inline LQIP are layers under all of this, for the first
 * paint only — the panel is visually complete before hydration, before any
 * video data, and permanently if video never loads at all.
 *
 * Playback pauses when the panel leaves the viewport or the tab is hidden,
 * and resumes where it stopped. Scrolling past never rewinds or skips.
 */
export function VisualPanel() {
  const { films, poster, lqip, focalPoint } = aboutReel;

  const rootRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const a = aRef.current;
    const b = bRef.current;
    if (!root || !a || !b || films.length === 0) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let disposed = false;
    let onScreen = false;
    let front = a;
    let standby = b;
    /** Index of the film on `front`. */
    let current = 0;
    /** The front film has ended and is waiting for the standby to be ready. */
    let waiting = false;
    /** The standby has been asked for its film. Held back until the first
     *  film is actually playing, so a direct load — or the intro, which
     *  parks the page off screen — spends its bandwidth on film one alone. */
    let standbyQueued = false;

    // Muted as a PROPERTY, before there is any source. React renders `muted`
    // as a property rather than an attribute, and iOS Safari only grants
    // autoplay to a video it can see is muted at the moment play() is asked
    // for — so this is stated here rather than left to the markup.
    for (const video of [a, b]) {
      video.muted = true;
      video.defaultMuted = true;
    }

    const load = (video: HTMLVideoElement, film: AboutReelFilm) => {
      // Each film carries its own crop: one shared focal point cannot frame
      // three different films.
      video.style.setProperty("--film-focal-desktop", film.focalPoint.desktop);
      video.style.setProperty("--film-focal-mobile", film.focalPoint.mobile);
      video.dataset.film = film.slug;
      video.src = film.src;
    };

    const wantsVideo = () => !disposed && !reducedMotion.matches;
    const wantsPlay = () =>
      wantsVideo() && onScreen && document.visibilityState !== "hidden";

    const play = (video: HTMLVideoElement) => {
      const started = video.play();
      if (!started) return;
      started
        .then(() => {
          // A late resolution must never override newer intent.
          if (video !== front || !wantsPlay()) video.pause();
        })
        .catch(() => {
          /* refused or interrupted — the current frame is already correct */
        });
    };

    const sync = () => {
      if (waiting) return;
      if (wantsPlay()) {
        if (front.paused && !front.ended && front.readyState >= HAS_FRAME) {
          play(front);
        }
        return;
      }
      // Pause only. currentTime is never touched, so scrolling away and back
      // continues the reel rather than restarting it.
      if (!front.paused) front.pause();
    };

    const queueStandby = () => {
      if (standbyQueued || films.length < 2) return;
      standbyQueued = true;
      load(standby, films[(current + 1) % films.length]);
    };

    /** The cut. Only ever called with a standby that can show a frame. */
    const cut = () => {
      waiting = false;
      const incoming = standby;
      const outgoing = front;
      // Same frame, no transition: the incoming film is visible on its first
      // frame at the instant the outgoing one disappears.
      incoming.classList.add(styles.videoCut);
      outgoing.classList.remove(styles.videoShown, styles.videoCut);
      front = incoming;
      standby = outgoing;
      current = (current + 1) % films.length;
      if (wantsPlay()) play(front);
      // Leapfrog: the element that just left carries the film after next.
      outgoing.pause();
      standbyQueued = false;
      queueStandby();
    };

    const onEnded = (event: Event) => {
      if (event.target !== front) return;
      if (films.length < 2) {
        front.currentTime = 0;
        sync();
        return;
      }
      if (standby.readyState >= HAS_FRAME) {
        cut();
        return;
      }
      // Not ready (a slow network, or a browser that ignores preload until
      // asked): hold the last frame, ask for playback — which forces the load
      // — and cut the moment a frame exists.
      waiting = true;
      queueStandby();
      standby.play()?.catch(() => undefined);
    };

    const onStandbyReady = (event: Event) => {
      if (event.target !== standby) return;
      if (waiting) {
        standby.pause();
        standby.currentTime = 0;
        cut();
      }
    };

    const onFirstFrame = (event: Event) => {
      if (event.target !== front || front.classList.contains(styles.videoCut)) {
        return;
      }
      // The very first film only: fade in over the poster — which is its
      // own first frame, so nothing appears to change.
      if (wantsVideo()) front.classList.add(styles.videoShown);
      sync();
    };

    const onPlaying = (event: Event) => {
      if (event.target === front) queueStandby();
    };

    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          onScreen =
            record.intersectionRatio >= (onScreen ? KEEP_RATIO : VISIBLE_RATIO);
        }
        sync();
      },
      { threshold: [0, KEEP_RATIO, VISIBLE_RATIO, 0.6, 1] },
    );

    // The poster gets the pipe first: it is the panel's guarantee, the video
    // is the enhancement. Assigning src IS the release — the elements ship
    // without one, so the preload scanner cannot start pulling video the
    // moment the document parses.
    const releaseFirst = () => {
      if (!front.src) load(front, films[0]);
    };
    const still = root.querySelector("img");
    if (!still || still.complete) releaseFirst();
    else {
      still.addEventListener("load", releaseFirst, { once: true });
      still.addEventListener("error", releaseFirst, { once: true });
    }

    for (const video of [a, b]) {
      video.addEventListener("ended", onEnded);
      video.addEventListener("loadeddata", onFirstFrame);
      video.addEventListener("loadeddata", onStandbyReady);
      video.addEventListener("playing", onPlaying);
    }
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);
    observer.observe(root);

    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reducedMotion.removeEventListener("change", sync);
      for (const video of [a, b]) {
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("loadeddata", onFirstFrame);
        video.removeEventListener("loadeddata", onStandbyReady);
        video.removeEventListener("playing", onPlaying);
        video.pause();
        // Release the decoder and the buffered media, not just the element.
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [films]);

  return (
    <div
      className={styles.panel}
      ref={rootRef}
      aria-hidden="true"
      style={
        {
          "--about-focal-desktop": focalPoint.desktop,
          "--about-focal-mobile": focalPoint.mobile,
          "--lqip": lqip ? `url("${lqip}")` : "none",
        } as React.CSSProperties
      }
    >
      {/* Layer 0: the inline LQIP, painted with the document itself. The panel
          is therefore never blank, at any bandwidth, before hydration. */}
      <div className={styles.placeholder} />

      {/* Layer 1: the first film's first frame. Eager and sync-decoded — this
          is the panel's visual, not a loading state. */}
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element -- the panel owns the crop, not the image optimiser.
        <img
          className={styles.media}
          src={poster}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="sync"
        />
      )}

      {/* Layers 2 and 3: the two film slots. Never both visible, never both
          playing. */}
      <video
        ref={aRef}
        className={`${styles.media} ${styles.video}`}
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
        disablePictureInPicture
      />
      <video
        ref={bRef}
        className={`${styles.media} ${styles.video}`}
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
        disablePictureInPicture
      />
    </div>
  );
}
