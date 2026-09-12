"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  getAdjacentProjects,
  projectHref,
  projectMetaLine,
  type Project,
} from "@/data/projects";
import { setViewerActive } from "@/components/ProjectCard/previewScheduler";
import { ProjectMetaText } from "@/components/ProjectMeta/ProjectMetaText";
import { SITE_ROOT_ID } from "@/lib/site";

import {
  hasStandaloneViewer,
  isModalOpen,
  modalClosedSnapshot,
  setModalOpen,
  setStandaloneViewer,
  subscribeViewerPresence,
} from "./viewerPresence";

import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from "./PlayerIcons";
import { PlayerControls } from "./PlayerControls";
import { ProjectFilm } from "./ProjectFilm";
import { useProjectPlayer } from "./useProjectPlayer";
import {
  PROJECT_SWITCH_OUT_DURATION,
  SWIPE_DOMINANCE,
  SWIPE_MAX_DURATION,
  SWIPE_MIN_DISTANCE,
  VIEWER_CLOSE_DURATION,
} from "./viewerConfig";

import styles from "./ProjectViewer.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export type ViewerMode =
  /** Opened from the mosaic. The homepage is still mounted behind it. */
  | "modal"
  /**
   * Arrived at /work/[slug] directly. There is nothing behind it.
   *
   * Not reachable in the current launch — the standalone route redirects to
   * the homepage instead of rendering — but the mode is intact and is what
   * restoring those pages would switch back on.
   */
  | "page";

/**
 * The project viewer.
 *
 * One component serves both entry points, because they are the same
 * experience: the same film, the same framing, the same controls, the same
 * previous/next. `mode` changes only the four things that genuinely differ —
 * what is behind it, whether the film starts on its own, where Close goes, and
 * whether there is a page underneath that needs protecting.
 *
 * Everything modal-specific is deliberately imperative and lives in one
 * effect: the scroll lock, the background's inertness, the focus round trip
 * and the homepage's paused previews are all facts about the document, not
 * about this component's markup.
 */
export function ProjectViewer({
  project,
  mode,
}: {
  project: Project;
  mode: ViewerMode;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [closing, setClosing] = useState(false);
  /** The slug whose film is currently fading out, if any. Derived rather than
   *  stored: the route arriving IS the end of the transition, so there is
   *  nothing to reset and nothing that can be left stuck. */
  const [leaving, setLeaving] = useState<string | null>(null);
  /** A direct-URL visitor who presses Next has given the gesture that a
   *  first-load visitor had not. From then on films may start themselves. */
  const [userNavigated, setUserNavigated] = useState(false);
  /** Which way the work is moving, so the outgoing film can lean that way. */
  const [direction, setDirection] = useState<"next" | "prev">("next");

  const hasFilm = Boolean(project.media?.fullVideo);
  const metaLine = projectMetaLine(project);
  const isModal = mode === "modal";

  // A standalone page steps aside when a modal opens over it — see
  // viewerPresence. Hooks all still run; only the markup goes.
  const coveredByModal = useSyncExternalStore(
    subscribeViewerPresence,
    isModalOpen,
    modalClosedSnapshot,
  );
  const yielded = !isModal && coveredByModal;

  // Captured at mount, before the page underneath has yielded: a modal opened
  // over a standalone project has no portfolio behind it in the history,
  // because that navigation replaced the entry rather than adding one.
  const [overStandalone] = useState(() => isModal && hasStandaloneViewer());

  /** Whether this film starts itself: an explicit click carries the intent
   *  (and the gesture) that a cold URL does not. */
  const autoPlay = hasFilm && (isModal || userNavigated);

  const player = useProjectPlayer({ slug: project.slug, autoPlay });
  const {
    videoRef,
    stageRef,
    ready,
    duration,
    buffering,
    controlsVisible,
    playing,
    togglePlay,
    toggleMuted,
    toggleFullscreen,
    bumpActivity,
    setControlsHovered,
    setControlsFocused,
  } = player;

  // ------------------------------------------------------------------- close
  const closeTimerRef = useRef(0);
  const close = useCallback(() => {
    if (closeTimerRef.current) return;
    videoRef.current?.pause();
    setClosing(true);
    closeTimerRef.current = window.setTimeout(
      () => {
        // A modal only ever exists because of a client-side navigation from
        // somewhere else on this site — a direct load renders the standalone
        // route instead. So there is always an entry to go back to, and Back
        // is what keeps the history honest. A standalone page has no such
        // guarantee, and must never send its visitor off the site.
        if (isModal && !overStandalone) router.back();
        else router.push("/");
      },
      reducedMotion() ? 0 : VIEWER_CLOSE_DURATION,
    );
  }, [isModal, overStandalone, router, videoRef]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  // ------------------------------------------------------- previous / next
  const switchTimerRef = useRef(0);
  /** The project the last press was heading for. Successive presses chain from
   *  it rather than from what is still on screen, so pressing Next three times
   *  quickly moves three projects and not one. */
  const pendingRef = useRef<string | null>(null);

  const step = useCallback(
    (direction: -1 | 1) => {
      if (closeTimerRef.current) return;
      const base = pendingRef.current ?? project.slug;
      const { previous, next } = getAdjacentProjects(base);
      const target = direction < 0 ? previous : next;
      if (!target || target.slug === base) return;

      pendingRef.current = target.slug;
      setDirection(direction < 0 ? "prev" : "next");
      setUserNavigated(true);
      setLeaving(project.slug);
      bumpActivity();
      // The outgoing film is not stopped here. ProjectFilm's own teardown
      // pauses it and drops its source when the element is destroyed, which is
      // the moment that actually matters — and it means a Next immediately
      // undone by a Prev lands back on a film that never stopped, instead of
      // on a paused one the viewer has to restart.

      // Replace, not push. After 01 -> 02 -> 03, Back should return the viewer
      // to the work it came from, not walk back through the films one at a
      // time. The open itself was a push, so that one entry is the way out.
      window.clearTimeout(switchTimerRef.current);
      switchTimerRef.current = window.setTimeout(
        () => {
          switchTimerRef.current = 0;
          router.replace(projectHref(target), { scroll: false });
        },
        reducedMotion() ? 0 : PROJECT_SWITCH_OUT_DURATION,
      );
    },
    [project.slug, router, bumpActivity],
  );

  // The incoming film is here: let it up. No effect and no reset — a
  // different slug simply is not the one that was leaving.
  const switching = leaving === project.slug;

  // The route settling is the end of a chain — including one this component
  // did not start, such as browser Back landing on a different film.
  useEffect(() => {
    pendingRef.current = null;
  }, [project.slug]);

  useEffect(() => () => window.clearTimeout(switchTimerRef.current), []);

  // ------------------------------------------------------------- presence
  useEffect(() => {
    if (isModal) {
      setModalOpen(true);
      return () => setModalOpen(false);
    }
    setStandaloneViewer(true);
    return () => setStandaloneViewer(false);
  }, [isModal]);

  // -------------------------------------------------- modal-only document work
  useEffect(() => {
    if (!isModal) return;

    // 1. The mosaic underneath stops decoding. It is not remounted, not reset
    //    and not reinterpreted — see previewScheduler.setViewerActive.
    setViewerActive(true);

    // 2. Nothing behind the film can be reached: not by pointer, not by Tab,
    //    not by a screen reader. `inert` is the whole modal contract in one
    //    attribute; blur is only what it looks like.
    const siteRoot = document.getElementById(SITE_ROOT_ID);
    siteRoot?.setAttribute("inert", "");

    // 3. Scroll lock that survives iOS, where overflow:hidden does not.
    //    Pinning the body is the only reliable form, and holding the exact
    //    offset is what makes closing land where the visitor left. The
    //    compensation keeps the layout from widening if a scrollbar was taking
    //    up space — on the desktop homepage it is zero, because there is none.
    const body = document.body;
    const scrollY = window.scrollY;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const previousStyle = body.getAttribute("style");
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    // 4. Focus goes in, and comes back to the frame it came from.
    //
    // Where it goes depends on how the viewer was opened. A pointer or
    // keyboard user gets the Close button — the useful first stop. A touch
    // user gets the dialog itself: focus still enters, screen readers still
    // announce it, but no control is left wearing a focus ring that the
    // person who tapped never asked for and cannot dismiss.
    const origin = document.activeElement as HTMLElement | null;
    const coarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: none)").matches;
    const entry = coarse ? rootRef.current : closeButtonRef.current;
    entry?.focus({ preventScroll: true });

    return () => {
      setViewerActive(false);
      siteRoot?.removeAttribute("inert");

      if (previousStyle === null) body.removeAttribute("style");
      else body.setAttribute("style", previousStyle);
      window.scrollTo(0, scrollY);

      // After the background is reachable again, never before.
      if (origin && document.contains(origin)) {
        origin.focus({ preventScroll: true });
      }
    };
  }, [isModal]);

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const onRange = target instanceof HTMLInputElement;
      const onButton = target instanceof HTMLButtonElement;

      switch (event.key) {
        case "Escape":
          if (isModal) {
            event.preventDefault();
            close();
          }
          return;
        case " ":
        case "Spacebar":
          // A focused button or slider owns its own space bar. Everywhere else
          // it is the film's, and it must not scroll the page.
          if (onButton || onRange) return;
          event.preventDefault();
          if (hasFilm) togglePlay();
          return;
        case "ArrowLeft":
          // Reserved for the work, except inside the timeline, where the
          // native range semantics are the accessible way to seek.
          if (onRange) return;
          event.preventDefault();
          step(-1);
          return;
        case "ArrowRight":
          if (onRange) return;
          event.preventDefault();
          step(1);
          return;
        case "m":
        case "M":
          if (onRange) return;
          if (hasFilm) toggleMuted();
          return;
        case "f":
        case "F":
          if (onRange) return;
          if (hasFilm) toggleFullscreen();
          return;
        default:
          bumpActivity();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    isModal,
    hasFilm,
    close,
    step,
    togglePlay,
    toggleMuted,
    toggleFullscreen,
    bumpActivity,
  ]);

  // Tab stays inside. `inert` already excludes the page behind, so this exists
  // for the wrap at either end rather than to do the excluding.
  const onRootKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || !isModal) return;
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(
      root.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((element) => element.offsetParent !== null);
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !root.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // ------------------------------------------------------------------ gesture
  //
  // One handler for the whole film region, because a tap and a swipe are the
  // same gesture right up until the finger lifts. Deciding both in one place
  // is what stops a swipe from also being read as a play/pause.
  //
  // Everything here is Pointer Events on one element: no library, no drag
  // model, and the film never follows the finger. The gesture is only ever
  // classified after the fact, so nothing moves until a decision is made.
  const gestureRef = useRef<{
    id: number;
    x: number;
    y: number;
    at: number;
  } | null>(null);

  const onRegionPointerDown = (event: React.PointerEvent) => {
    // A mouse has Previous and Next in front of it and does not need this.
    if (event.pointerType === "mouse") return;
    gestureRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
    };
  };

  const cancelGesture = () => {
    gestureRef.current = null;
  };

  const onRegionPointerUp = (event: React.PointerEvent) => {
    if (closing) return;
    const start = gestureRef.current;
    gestureRef.current = null;

    if (start && start.id === event.pointerId) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      // Deliberate, horizontal, and quick enough to be a flick rather than a
      // thumb resting on the screen. Anything else falls through to the tap.
      if (
        ax >= SWIPE_MIN_DISTANCE &&
        ax >= ay * SWIPE_DOMINANCE &&
        performance.now() - start.at <= SWIPE_MAX_DURATION
      ) {
        // The same call Previous and Next make — one source of truth for the
        // route, the history policy and the pending chain (§65).
        step(dx < 0 ? 1 : -1);
        return;
      }
      // A finger that travelled at all was reaching, not tapping.
      if (ax > 10 || ay > 10) {
        bumpActivity();
        return;
      }
    }

    // Only the film itself toggles playback; the space around it just wakes
    // the interface, which on a phone holding a landscape cut is most of the
    // screen and must not be a pause button.
    const onFilm =
      event.target instanceof Element && event.target.closest("[data-film]");
    if (!hasFilm || !onFilm) {
      bumpActivity();
      return;
    }

    // On a touch screen the first tap is how the controls are asked for, so it
    // is not also a pause: the viewer was reaching for the UI, not the film.
    const coarse = event.pointerType === "touch" || event.pointerType === "pen";
    if (coarse && !controlsVisible) {
      bumpActivity();
      return;
    }
    togglePlay();
  };

  const ratio = project.media?.aspectRatio;

  if (yielded) return null;

  return (
    <div
      ref={rootRef}
      className={styles.viewer}
      tabIndex={-1}
      data-mode={mode}
      data-state={closing ? "closing" : "open"}
      data-switch={switching ? "out" : "in"}
      data-dir={direction}
      data-has-film={hasFilm ? "true" : "false"}
      data-idle={!controlsVisible && playing ? "true" : "false"}
      onPointerMove={bumpActivity}
      onKeyDown={onRootKeyDown}
      // Keyboard focus in the chrome holds it open. Only keyboard focus:
      // opening the viewer with the mouse puts focus on Close deliberately,
      // and if that counted the controls would never fade for a mouse user at
      // all. `:focus-visible` is the browser's own answer to which kind of
      // focus this is, so it is not re-derived here.
      // Tracked at the root so moving between the top bar and the control bar
      // is not read as leaving, which per-bar handlers would get wrong.
      onFocus={(event) =>
        setControlsFocused(
          event.target instanceof Element &&
            event.target.matches(":focus-visible"),
        )
      }
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setControlsFocused(false);
        }
      }}
      role={isModal ? "dialog" : undefined}
      aria-modal={isModal ? true : undefined}
      // Named by the identification it already shows, rather than by a second
      // copy of the same words: an aria-label here would be announced on entry
      // and the heading announced again on the way past it.
      aria-labelledby={
        metaLine ? "project-viewer-title project-viewer-meta" : "project-viewer-title"
      }
    >
      <div className={styles.backdrop} aria-hidden="true" />

      <div
        className={styles.stage}
        ref={stageRef}
        style={
          ratio ? ({ "--film-ratio": String(ratio) } as React.CSSProperties) : undefined
        }
      >
        <header
          className={styles.topbar}
          onPointerEnter={() => setControlsHovered(true)}
          onPointerLeave={() => setControlsHovered(false)}
        >
          <div className={styles.identity}>
            <h1 id="project-viewer-title" className={styles.title}>
              {project.title}
            </h1>
            {metaLine && (
              <p id="project-viewer-meta" className={styles.meta}>
                <ProjectMetaText project={project} noteClassName={styles.metaNote} />
              </p>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.navButton}
              onClick={() => step(-1)}
              aria-label="Previous project"
            >
              <ArrowLeftIcon className={styles.navGlyph} />
              <span className={styles.navLabel}>Prev</span>
            </button>
            <button
              type="button"
              className={styles.navButton}
              onClick={() => step(1)}
              aria-label="Next project"
            >
              <span className={styles.navLabel}>Next</span>
              <ArrowRightIcon className={styles.navGlyph} />
            </button>

            <span className={styles.actionsDivider} aria-hidden="true" />

            {/* A modal closes itself; a standalone page is a page, and its
                close is a real link to the work — right-clickable, and
                correct with JavaScript disabled. */}
            {isModal ? (
              <button
                type="button"
                ref={closeButtonRef}
                className={styles.closeButton}
                onClick={close}
                aria-label="Close project"
              >
                <CloseIcon />
              </button>
            ) : (
              <Link
                href="/"
                className={styles.closeButton}
                aria-label="Close project"
                onClick={(event) => {
                  event.preventDefault();
                  close();
                }}
              >
                <CloseIcon />
              </Link>
            )}
          </div>
        </header>

        <div
          className={styles.frame}
          onPointerDown={onRegionPointerDown}
          onPointerUp={onRegionPointerUp}
          onPointerCancel={cancelGesture}
        >
          <div className={styles.film} data-film={hasFilm ? "true" : "false"}>
            <ProjectFilm
              key={project.slug}
              project={project}
              videoRef={videoRef}
              ready={ready}
              eager={autoPlay}
            />
            {/* Admitted to only after a stall has lasted long enough to be a
                stall. Four dots in a corner, never over the work. */}
            <span
              className={styles.buffering}
              data-visible={buffering ? "true" : "false"}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className={styles.controls}>
          {hasFilm && <PlayerControls player={player} duration={duration} />}
        </div>
      </div>
    </div>
  );
}
