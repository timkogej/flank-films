"use client";

import styles from "./DarkLightDevPanel.module.css";

interface Props {
  rate: number;
  paused: boolean;
  onRate: (rate: number) => void;
  onPause: () => void;
  onReplay: () => void;
}

/**
 * Development-only controls for the isolated test route: replay, pause and
 * speed, so the sequence can be watched repeatedly without reloading.
 *
 * The material, reflection, polish and ground studies this panel used to
 * switch between are gone — those choices are resolved and the winners are
 * the only values in the stylesheet. There is nothing here that can change
 * what the intro looks like.
 *
 * Never rendered on the homepage: it is gated on both `process.env.NODE_ENV`
 * and an explicit `controls` prop that only the test route passes.
 */
export function DarkLightDevPanel({
  rate,
  paused,
  onRate,
  onPause,
  onReplay,
}: Props) {
  return (
    <div className={styles.panel} data-darklight-dev="">
      <button type="button" onClick={onReplay}>
        Replay
      </button>
      <button type="button" onClick={onPause} data-on={paused ? "" : undefined}>
        {paused ? "Play" : "Pause"}
      </button>
      <span className={styles.rule} />
      {[0.5, 1].map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onRate(r)}
          data-on={rate === r ? "" : undefined}
        >
          {r}×
        </button>
      ))}
    </div>
  );
}
