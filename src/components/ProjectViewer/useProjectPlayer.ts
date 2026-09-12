"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  BUFFER_INDICATOR_DELAY,
  CONTROL_HIDE_DELAY,
  CONTROL_HIDE_DELAY_TOUCH,
} from "./viewerConfig";

/** A finger needs longer than a pointer. Read at the moment the timer is armed
 *  rather than cached, so a tablet that gains a trackpad is answered honestly. */
function hideDelay(): number {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none)").matches
    ? CONTROL_HIDE_DELAY_TOUCH
    : CONTROL_HIDE_DELAY;
}

/** Vendor-prefixed fullscreen, still the only path on Safari. */
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export interface ProjectPlayer {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** The element that goes fullscreen: film AND controls, never the raw video. */
  stageRef: React.RefObject<HTMLDivElement | null>;
  /** Written to imperatively on every frame. Never React state. */
  seekRef: React.RefObject<HTMLInputElement | null>;
  timeRef: React.RefObject<HTMLTimeElement | null>;

  playing: boolean;
  muted: boolean;
  ended: boolean;
  /** The video can draw a frame; the poster may stand down. */
  ready: boolean;
  duration: number;
  buffering: boolean;
  fullscreen: boolean;
  fullscreenSupported: boolean;
  controlsVisible: boolean;

  togglePlay: () => void;
  toggleMuted: () => void;
  toggleFullscreen: () => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  onSeek: (seconds: number) => void;
  /** Pointer moved, a key was pressed, something happened. Show the controls. */
  bumpActivity: () => void;
  setControlsHovered: (hovered: boolean) => void;
  setControlsFocused: (focused: boolean) => void;
}

/** 0:00 / 1:32 — the shortest form that is still unambiguous. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes < 60) return `${minutes}:${rest.toString().padStart(2, "0")}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${rest
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Everything the film knows about itself.
 *
 * The design rule throughout: React state describes things that change a few
 * times per film — playing, muted, duration, readiness. The playhead is not
 * one of those. It moves sixty times a second and it is only ever read by two
 * DOM nodes, so it is written straight to them and never enters a render.
 *
 * `autoPlay` is the difference between the two entry points. Opening a project
 * from the mosaic is an explicit request to watch it, and it carries the click
 * that lets a browser allow sound. Arriving on a URL is not: that film waits,
 * showing its poster, until someone presses play.
 */
export function useProjectPlayer({
  slug,
  autoPlay,
}: {
  /** Changing this is a different film: everything resets. */
  slug: string;
  autoPlay: boolean;
}): ProjectPlayer {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const seekRef = useRef<HTMLInputElement | null>(null);
  const timeRef = useRef<HTMLTimeElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);

  // Read by timers and event handlers that must not re-subscribe.
  const controlsVisibleRef = useRef(true);
  const hideTimerRef = useRef(0);
  const holdRef = useRef(true);
  const pointerInControlsRef = useRef(false);
  const focusInControlsRef = useRef(false);
  const resumeOnVisibleRef = useRef(false);

  // ------------------------------------------------------------------ paint
  /** Push the playhead into the two nodes that show it. No render involved. */
  const paint = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const total = Number.isFinite(video.duration) ? video.duration : 0;
    const current = video.currentTime;

    const seek = seekRef.current;
    if (seek && document.activeElement !== seek) {
      seek.value = String(current);
      seek.style.setProperty(
        "--progress",
        `${total > 0 ? (current / total) * 100 : 0}%`,
      );
    }
    const label = timeRef.current;
    if (label) label.textContent = formatTime(current);
  }, []);

  const frameRef = useRef(0);
  const runFrames = useCallback(() => {
    const step = () => {
      paint();
      frameRef.current = requestAnimationFrame(step);
    };
    if (!frameRef.current) frameRef.current = requestAnimationFrame(step);
  }, [paint]);
  const stopFrames = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
  }, []);

  // A smooth playhead is only worth a frame loop while somebody is looking at
  // it. Otherwise `timeupdate` keeps it honest at a few hertz.
  useEffect(() => {
    if (playing && controlsVisible && !scrubbing) runFrames();
    else {
      stopFrames();
      paint();
    }
    return stopFrames;
  }, [playing, controlsVisible, scrubbing, runFrames, stopFrames, paint]);

  // -------------------------------------------------------- control visibility
  const armHideTimer = useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
    if (holdRef.current) return;
    hideTimerRef.current = window.setTimeout(() => {
      if (holdRef.current) return;
      controlsVisibleRef.current = false;
      setControlsVisible(false);
    }, hideDelay());
  }, []);

  const bumpActivity = useCallback(() => {
    if (!controlsVisibleRef.current) {
      controlsVisibleRef.current = true;
      setControlsVisible(true);
    }
    armHideTimer();
  }, [armHideTimer]);

  // The rules for staying visible (§43), evaluated on every render and read by
  // the timer when it fires.
  const hold =
    !playing || ended || scrubbing || buffering || !ready;
  useEffect(() => {
    holdRef.current =
      hold || pointerInControlsRef.current || focusInControlsRef.current;
    if (holdRef.current) {
      window.clearTimeout(hideTimerRef.current);
      if (!controlsVisibleRef.current) {
        controlsVisibleRef.current = true;
        setControlsVisible(true);
      }
      return;
    }
    armHideTimer();
  }, [hold, armHideTimer]);

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), []);

  const setControlsHovered = useCallback(
    (hovered: boolean) => {
      pointerInControlsRef.current = hovered;
      holdRef.current = hold || hovered || focusInControlsRef.current;
      bumpActivity();
    },
    [hold, bumpActivity],
  );

  const setControlsFocused = useCallback(
    (focused: boolean) => {
      focusInControlsRef.current = focused;
      holdRef.current = hold || focused || pointerInControlsRef.current;
      bumpActivity();
    },
    [hold, bumpActivity],
  );

  // ------------------------------------------------------------ media events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    let bufferTimer = 0;
    // Local to this effect, so a project switch resets it for free.
    let autoPlayAttempted = false;

    // A new film starts from nothing known about it.
    setReady(false);
    setEnded(false);
    setPlaying(false);
    setBuffering(false);
    setDuration(0);
    setMuted(false);

    /**
     * Ask for sound first, because the viewer just asked for this film and
     * that click is what a browser wants to see. If it is refused anyway, fall
     * back to a muted film rather than to no film — and say so through the
     * sound control, which is then the obvious thing to press. No policy is
     * defeated here, and no rejection goes unhandled.
     */
    const attemptAutoPlay = () => {
      video.muted = false;
      const started = video.play();
      if (!started) return;
      started.catch(() => {
        if (disposed) return;
        video.muted = true;
        setMuted(true);
        const retry = video.play();
        if (retry) retry.catch(() => setPlaying(false));
      });
    };

    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      // The declared ratio was an estimate; this is the truth.
      if (video.videoWidth && video.videoHeight) {
        stageRef.current?.style.setProperty(
          "--film-ratio",
          `${video.videoWidth} / ${video.videoHeight}`,
        );
      }
      paint();
      // Playback is attempted only once there is something to play. Calling
      // play() on an element that has no source yet is a guaranteed rejection.
      if (autoPlay && !autoPlayAttempted) {
        autoPlayAttempted = true;
        attemptAutoPlay();
      }
    };
    const onDurationChange = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };
    const onLoadedData = () => {
      setReady(true);
      paint();
    };
    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      // No loop, no auto-advance: the film holds on its last frame and the
      // controls come back. Anything else decides for the viewer.
      setEnded(true);
      setPlaying(false);
      paint();
    };
    const onTimeUpdate = () => {
      if (!frameRef.current) paint();
      const seek = seekRef.current;
      if (seek) {
        seek.setAttribute(
          "aria-valuetext",
          `${formatTime(video.currentTime)} of ${formatTime(video.duration)}`,
        );
      }
    };
    const onVolumeChange = () => setMuted(video.muted);
    const onWaiting = () => {
      window.clearTimeout(bufferTimer);
      bufferTimer = window.setTimeout(() => {
        if (!disposed) setBuffering(true);
      }, BUFFER_INDICATOR_DELAY);
    };
    const onSettled = () => {
      window.clearTimeout(bufferTimer);
      setBuffering(false);
    };
    const onSeeked = () => {
      onSettled();
      paint();
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("play", onPlay);
    video.addEventListener("playing", onSettled);
    video.addEventListener("canplay", onSettled);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("seeked", onSeeked);

    // Events can already have fired before this effect ran; browsers disagree
    // about the order, so the current readyState is the authority.
    if (video.readyState >= 1) onLoadedMetadata();
    if (video.readyState >= 2) onLoadedData();

    return () => {
      disposed = true;
      window.clearTimeout(bufferTimer);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("playing", onSettled);
      video.removeEventListener("canplay", onSettled);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [slug, autoPlay, paint]);

  // --------------------------------------------------------- tab visibility
  useEffect(() => {
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.visibilityState === "hidden") {
        // Nothing is gained by decoding a film into a hidden tab.
        resumeOnVisibleRef.current = !video.paused && !video.ended;
        if (resumeOnVisibleRef.current) video.pause();
        return;
      }
      // Resume only what was genuinely interrupted, in exactly the state it
      // was interrupted in — including its sound. Coming back to a tab must
      // never start something the viewer had not already started.
      if (!resumeOnVisibleRef.current) return;
      resumeOnVisibleRef.current = false;
      const resumed = video.play();
      if (resumed) resumed.catch(() => setPlaying(false));
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // -------------------------------------------------------------- fullscreen
  useEffect(() => {
    const stage = stageRef.current as FullscreenElement | null;
    setFullscreenSupported(
      Boolean(
        stage &&
          (typeof stage.requestFullscreen === "function" ||
            typeof stage.webkitRequestFullscreen === "function"),
      ),
    );

    const doc = document as FullscreenDocument;
    const onChange = () => {
      setFullscreen(
        Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement),
      );
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current as FullscreenElement | null;
    const doc = document as FullscreenDocument;
    if (!stage) return;

    const active = doc.fullscreenElement ?? doc.webkitFullscreenElement;
    try {
      if (active) {
        const exit = doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.();
        if (exit instanceof Promise) exit.catch(() => undefined);
        return;
      }
      const enter =
        stage.requestFullscreen?.() ?? stage.webkitRequestFullscreen?.();
      if (enter instanceof Promise) enter.catch(() => undefined);
    } catch {
      /* refused by the browser — the film keeps playing exactly as it was */
    }
  }, []);

  // ----------------------------------------------------------------- actions
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    bumpActivity();
    if (video.paused || video.ended) {
      // Pressing play on a finished film replays it from the top.
      if (video.ended) video.currentTime = 0;
      const started = video.play();
      if (started) started.catch(() => setPlaying(false));
      return;
    }
    video.pause();
  }, [bumpActivity]);

  const toggleMuted = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    bumpActivity();
    video.muted = !video.muted;
    setMuted(video.muted);
  }, [bumpActivity]);

  const onSeek = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(seconds)) return;
      video.currentTime = seconds;
      if (video.ended) setEnded(false);
      const seek = seekRef.current;
      const total = Number.isFinite(video.duration) ? video.duration : 0;
      if (seek) {
        seek.style.setProperty(
          "--progress",
          `${total > 0 ? (seconds / total) * 100 : 0}%`,
        );
      }
      const label = timeRef.current;
      if (label) label.textContent = formatTime(seconds);
    },
    [],
  );

  const onScrubStart = useCallback(() => {
    setScrubbing(true);
    bumpActivity();
  }, [bumpActivity]);
  const onScrubEnd = useCallback(() => setScrubbing(false), []);

  return {
    videoRef,
    stageRef,
    seekRef,
    timeRef,
    playing,
    muted,
    ended,
    ready,
    duration,
    buffering,
    fullscreen,
    fullscreenSupported,
    controlsVisible,
    togglePlay,
    toggleMuted,
    toggleFullscreen,
    onScrubStart,
    onScrubEnd,
    onSeek,
    bumpActivity,
    setControlsHovered,
    setControlsFocused,
  };
}
