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

    /** A play() request is in flight on this element. */
    const starting = new WeakSet<HTMLVideoElement>();
    /** Its last request was refused; asked again only on a readiness event. */
    const refused = new WeakSet<HTMLVideoElement>();

    const play = (video: HTMLVideoElement) => {
      if (starting.has(video) || refused.has(video)) return;
      // Stated at the moment of asking: iOS grants muted autoplay only to an
      // element it can see is muted and inline now.
      video.muted = true;
      video.playsInline = true;
      starting.add(video);
      const started = video.play();
      if (!started) {
        starting.delete(video);
        return;
      }
      started
        .then(() => {
          starting.delete(video);
          // A late resolution must never override newer intent.
          if (video !== front || !wantsPlay()) video.pause();
        })
        .catch((error: unknown) => {
          starting.delete(video);
          // Interrupted by our own pause() — intended. Anything else waits
          // for the element to report progress. The current frame is already
          // correct either way.
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            refused.add(video);
          }
        });
    };

    const sync = () => {
      if (waiting) return;
      if (wantsPlay()) {
        // Not gated on a decoded frame. Waiting for `loadeddata` before asking
        // made the start a relay — source, frame, observer, play() — and on
        // iOS, which does not buffer ahead until playback is requested, the
        // frame could wait on the request that was waiting on the frame. The
        // browser starts the moment it can; the poster (this film's own frame
        // 0) covers the gap, so there is nothing to see until it moves.
        if (front.src && front.paused && !front.ended) play(front);
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
      refused.delete(front);
      sync();
    };

    const onPlaying = (event: Event) => {
      if (event.target === front) queueStandby();
    };

    // The element can now do more than when it was last asked: the moment a
    // refused or premature request is worth repeating. Event-driven, so a
    // refusal costs at most one retry per stage of loading — never a loop.
    const onReadiness = (event: Event) => {
      const video = event.target as HTMLVideoElement;
      refused.delete(video);
      if (video === front) sync();
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

    // Assigning src IS the release — the elements ship without one, so the
    // preload scanner cannot start pulling video the moment the document
    // parses. It is released at mount, alongside the poster rather than after
    // it.
    //
    // It used to wait for the poster to finish, which on a client-side
    // arrival — Home to About, where the poster is usually not cached — put a
    // whole image download in front of the first byte of the film, and the
    // panel then sat on a still while the reel caught up. The poster does not
    // need that protection: it is already requested by the document with
    // fetchpriority="high", and media requests are the lowest priority a
    // browser has, so the film cannot starve it. On a direct load this also
    // gives the first film the entire intro to buffer. Only film one — the
    // standby still waits until film one is actually playing.
    load(front, films[0]);

    // Where the panel is right now, not after the observer's first delivery a
    // frame or more from now. On an arrival that already shows the panel, the
    // play request goes out in this same task. The observer stays the
    // authority and corrects this on its first record.
    {
      const rect = root.getBoundingClientRect();
      const height =
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      const width =
        Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
      onScreen =
        rect.height > 0 &&
        height > 0 &&
        width > 0 &&
        height / rect.height >= VISIBLE_RATIO;
    }

    for (const video of [a, b]) {
      video.addEventListener("ended", onEnded);
      video.addEventListener("loadeddata", onFirstFrame);
      video.addEventListener("loadeddata", onStandbyReady);
      video.addEventListener("playing", onPlaying);
      video.addEventListener("loadedmetadata", onReadiness);
      video.addEventListener("canplay", onReadiness);
    }
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);
    observer.observe(root);
    sync();

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
        video.removeEventListener("loadedmetadata", onReadiness);
        video.removeEventListener("canplay", onReadiness);
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
