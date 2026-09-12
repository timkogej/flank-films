"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import styles from "./FlankLightPanel.module.css";

/**
 * How fast each part of the light catches up with the pointer, as the share of
 * the remaining distance covered per 60 Hz frame. Close together on purpose:
 * the parts lean slightly in the direction of travel — enough for the light
 * to feel like it has mass — but never far enough apart to be seen as
 * separate lights.
 */
const FOLLOW = { core: 0.2, satellite: 0.165, atmosphere: 0.13 } as const;
type Lobe = keyof typeof FOLLOW;
const LOBES = Object.keys(FOLLOW) as Lobe[];
const VAR: Record<Lobe, [string, string]> = {
  core: ["--cx", "--cy"],
  satellite: ["--sx", "--sy"],
  atmosphere: ["--hx", "--hy"],
};

/**
 * The FLANK light panel.
 *
 * Layers, all in identical geometry:
 *   base    — black field carrying the white wordmark.
 *   haze    — a dim atmospheric lift, broad and very soft.
 *   invert  — the lit surface, strongest where the light is.
 *   invertMark — the black wordmark, revealed where the light is strong
 *             enough to flip the mark.
 *   reveal  — the light field used by the no-pointer one-shot sweep.
 *
 * Neither field is one shape. Each is two or three overlapping soft lobes
 * with a Gaussian falloff — no flat core and no shoulder, so there is no rim
 * anywhere for the eye to trace — offset from one another and following the
 * pointer at different rates. What reads is light, not a gradient's outline.
 *
 * Every wordmark is the official SVG at the same width in the same grid-centred
 * box, so the inverted mark is registered by layout rather than by hand.
 *
 * Behaviour depends on the device, not on the screen width:
 *   fine pointer  — the light follows the cursor (CSS custom properties, one
 *                   rAF per frame while anything is still moving, no React
 *                   state and no layout reads).
 *   otherwise     — one automatic sweep the first time the panel is seen.
 *
 * The panel is decorative: the wordmark is already announced by the header and
 * the heading, so every layer is hidden from assistive technology.
 */
export function FlankLightPanel() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (finePointer.matches) {
      const target = { x: 0, y: 0 };
      const pos: Record<Lobe, { x: number; y: number }> = {
        core: { x: 0, y: 0 },
        satellite: { x: 0, y: 0 },
        atmosphere: { x: 0, y: 0 },
      };
      let frame = 0;
      let last = 0;

      const write = () => {
        for (const lobe of LOBES) {
          const [vx, vy] = VAR[lobe];
          el.style.setProperty(vx, `${pos[lobe].x.toFixed(1)}px`);
          el.style.setProperty(vy, `${pos[lobe].y.toFixed(1)}px`);
        }
      };

      const step = (now: number) => {
        // Frame-rate independent: the same pointer path produces the same
        // light path at 60, 120 or a throttled 30 Hz.
        const dt = last ? Math.min(now - last, 64) : 16.667;
        last = now;
        let moving = false;
        for (const lobe of LOBES) {
          const k = reducedMotion.matches
            ? 1
            : 1 - Math.pow(1 - FOLLOW[lobe], dt / 16.667);
          const p = pos[lobe];
          p.x += (target.x - p.x) * k;
          p.y += (target.y - p.y) * k;
          if (Math.abs(target.x - p.x) > 0.3 || Math.abs(target.y - p.y) > 0.3) {
            moving = true;
          }
        }
        write();
        frame = moving ? requestAnimationFrame(step) : 0;
        if (!frame) last = 0;
      };

      const onMove = (event: PointerEvent) => {
        // Children are pointer-events:none, so the panel is always the target
        // and offsetX/offsetY are panel-relative. No getBoundingClientRect,
        // therefore no layout read per frame.
        target.x = event.offsetX;
        target.y = event.offsetY;
        if (!frame) frame = requestAnimationFrame(step);
      };

      const onEnter = (event: PointerEvent) => {
        // Seed every lobe at the pointer before revealing, so the light never
        // fades in at a stale spot and slides across to the cursor.
        target.x = event.offsetX;
        target.y = event.offsetY;
        for (const lobe of LOBES) pos[lobe] = { x: target.x, y: target.y };
        write();
        el.classList.add(styles.lit);
      };

      // The lobes keep settling while the light fades, so it goes out in one
      // piece where the pointer left it rather than freezing mid-stretch.
      const onLeave = () => el.classList.remove(styles.lit);

      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
      el.addEventListener("pointercancel", onLeave);

      return () => {
        if (frame) cancelAnimationFrame(frame);
        el.removeEventListener("pointerenter", onEnter);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
        el.removeEventListener("pointercancel", onLeave);
      };
    }

    // No fine pointer: one automatic reveal, the first time it is seen.
    if (reducedMotion.matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.classList.add(styles.swept);
          observer.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={styles.panel}>
      <div className={styles.layer} aria-hidden="true">
        <Image
          src="/brand/flank-wordmark-white.svg"
          alt=""
          width={1499}
          height={226}
          className={styles.mark}
        />
      </div>
      <div className={`${styles.layer} ${styles.haze}`} aria-hidden="true" />
      <div className={`${styles.layer} ${styles.invert}`} aria-hidden="true" />
      <div className={`${styles.layer} ${styles.invertMark}`} aria-hidden="true">
        <Image
          src="/brand/flank-wordmark-black.svg"
          alt=""
          width={1499}
          height={226}
          className={styles.mark}
        />
      </div>
      <div className={`${styles.layer} ${styles.reveal}`} aria-hidden="true">
        <Image
          src="/brand/flank-wordmark-black.svg"
          alt=""
          width={1499}
          height={226}
          className={styles.mark}
        />
      </div>
    </div>
  );
}
