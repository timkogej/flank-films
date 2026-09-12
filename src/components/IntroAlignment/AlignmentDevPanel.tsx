"use client";

import type { StudyId } from "./alignmentConfig";
import { STUDIES } from "./alignmentConfig";

import styles from "./AlignmentDevPanel.module.css";

interface Props {
  study: StudyId;
  rate: number;
  paused: boolean;
  guides: boolean;
  onStudy: (id: StudyId) => void;
  onRate: (rate: number) => void;
  onPause: () => void;
  onGuides: () => void;
  onReplay: () => void;
}

/**
 * Development-only controls. Replay, speed, pause, the three studies and the
 * geometry guides — and deliberately nothing else. This is not a motion
 * editor; the score is a file.
 */
export function AlignmentDevPanel({
  study,
  rate,
  paused,
  guides,
  onStudy,
  onRate,
  onPause,
  onGuides,
  onReplay,
}: Props) {
  return (
    <div className={styles.panel} data-alignment-dev="">
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
      <span className={styles.rule} />
      {(Object.keys(STUDIES) as StudyId[]).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onStudy(id)}
          data-on={study === id ? "" : undefined}
          title={STUDIES[id].note}
        >
          {id} {STUDIES[id].name}
        </button>
      ))}
      <span className={styles.rule} />
      <button type="button" onClick={onGuides} data-on={guides ? "" : undefined}>
        Guides
      </button>
    </div>
  );
}
