"use client";

import {
  FullscreenEnterIcon,
  FullscreenExitIcon,
  PauseIcon,
  PlayIcon,
  SoundOffIcon,
  SoundOnIcon,
} from "./PlayerIcons";
import { formatTime, type ProjectPlayer } from "./useProjectPlayer";

import styles from "./ProjectViewer.module.css";

/**
 * The bottom bar.
 *
 * Left: play/pause and the playhead. Centre: the timeline, taking whatever
 * width is left. Right: sound and fullscreen. Nothing else — no speed, no
 * quality, no settings, no chapters, no download. A commercial has one thing
 * to do and the bar has five.
 *
 * The playhead never passes through React. `timeRef` and the range input are
 * written to directly by the player, so a film can run for ninety seconds
 * without re-rendering anything.
 */
export function PlayerControls({
  player,
  duration,
}: {
  player: ProjectPlayer;
  duration: number;
}) {
  const {
    playing,
    ended,
    muted,
    fullscreen,
    fullscreenSupported,
    seekRef,
    timeRef,
    togglePlay,
    toggleMuted,
    toggleFullscreen,
    onScrubStart,
    onScrubEnd,
    onSeek,
    setControlsHovered,
  } = player;

  return (
    <div
      className={styles.bar}
      onPointerEnter={() => setControlsHovered(true)}
      onPointerLeave={() => setControlsHovered(false)}
    >
      <button
        type="button"
        className={styles.control}
        onClick={togglePlay}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing && !ended ? <PauseIcon /> : <PlayIcon />}
      </button>

      <p className={styles.time}>
        <time ref={timeRef}>0:00</time>
        <span className={styles.timeRest} aria-hidden="true">
          {" / "}
          {formatTime(duration)}
        </span>
      </p>

      {/* A real range input, so keyboard seeking, touch dragging and assistive
          technology all work without being reimplemented. Everything visible
          about it is CSS: a 2px track with a hit area several times its
          height. */}
      <input
        ref={seekRef}
        type="range"
        className={styles.seek}
        min={0}
        max={duration || 0}
        step={0.01}
        defaultValue={0}
        aria-label="Seek"
        onPointerDown={onScrubStart}
        onPointerUp={onScrubEnd}
        onPointerCancel={onScrubEnd}
        onKeyDown={onScrubStart}
        onKeyUp={onScrubEnd}
        onChange={(event) => onSeek(Number(event.currentTarget.value))}
      />

      <button
        type="button"
        className={styles.control}
        onClick={toggleMuted}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <SoundOffIcon /> : <SoundOnIcon />}
      </button>

      {/* Absent rather than disabled where the browser has no element
          fullscreen — iOS Safari, most notably. A control that cannot do
          anything is worse than one that was never offered. */}
      {fullscreenSupported && (
        <button
          type="button"
          className={styles.control}
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {fullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
        </button>
      )}
    </div>
  );
}
