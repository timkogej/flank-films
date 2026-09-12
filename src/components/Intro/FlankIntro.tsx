"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { setPreviewPrewarm } from "@/components/ProjectCard/previewScheduler";

import {
  INTRO_MODE,
  INTRO_REDUCED_TOTAL_MS,
  INTRO_TOTAL_MS,
} from "./introConfig";

import styles from "./FlankIntro.module.css";

/**
 * The FLANK intro / page reveal.
 *
 * Structure:
 *   .stage   clips the viewport while the sequence runs
 *     .curtain  fixed black field + the white wordmark + the light beam
 *     .riser    the REAL homepage, translated down by one viewport and
 *               animated back to 0 — it occludes the curtain as it arrives
 *
 * The whole sequence is declarative CSS. It is server-rendered in its opening
 * state, so the first paint the browser makes is already black — there is no
 * frame of white homepage and no useEffect racing the paint. React is used
 * only to end the sequence: it drops the curtain and clears the transform so
 * the finished page is byte-for-byte the normal homepage.
 *
 * The beam inverts the wordmark through `mix-blend-mode: difference` against a
 * SINGLE logo layer, so perfect alignment is structural rather than something
 * that has to be maintained — there is no second copy to drift.
 *
 * Nothing about the sequence above is timed, sized or eased by anything below.
 * The only thing the intro tells the rest of the page is WHEN it is running,
 * so the homepage's autoplay previews can be alive by the time it lifts. The
 * media never delays the intro; the intro never waits for the media.
 */
export function FlankIntro({ children }: { children: React.ReactNode }) {
  const enabled = INTRO_MODE === "every-load";
  const [running, setRunning] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The homepage is mounted and parked a viewport below, so its autoplay
    // previews may start loading and playing now rather than on arrival. This
    // is purely a declaration of state — it changes nothing about what the
    // curtain does, and the timeout below is untouched. Reduced motion is
    // handled by the previews themselves, which refuse to play at all.
    setPreviewPrewarm(true);

    const id = window.setTimeout(
      () => setRunning(false),
      reduced ? INTRO_REDUCED_TOTAL_MS : INTRO_TOTAL_MS,
    );

    // Tied to mount, not to renders: resizing, re-rendering or a language
    // toggle cannot restart the sequence.
    return () => {
      window.clearTimeout(id);
      setPreviewPrewarm(false);
    };
  }, [enabled]);

  useEffect(() => {
    if (running) return;

    // Hand back to the ordinary rules one frame late, on purpose. The riser's
    // transform clears in the same commit that ends the sequence, and the
    // observer reports the new positions after the next paint. Releasing the
    // prewarm in between would briefly see every card as still off screen and
    // pause the very previews that are now on the page.
    const outer = requestAnimationFrame(() => {
      const inner = requestAnimationFrame(() => setPreviewPrewarm(false));
      frames.push(inner);
    });
    const frames: number[] = [outer];

    return () => frames.forEach(cancelAnimationFrame);
  }, [running]);

  return (
    <div className={running ? `${styles.stage} ${styles.running}` : styles.stage}>
      {running && (
        <div className={styles.curtain} aria-hidden="true">
          <div className={styles.mark}>
            <Image
              src="/brand/flank-wordmark-white.svg"
              alt=""
              width={1499}
              height={226}
              priority
              className={styles.markImage}
            />
          </div>
          <div className={styles.beam} />
        </div>
      )}
      <div className={styles.riser}>{children}</div>
    </div>
  );
}
