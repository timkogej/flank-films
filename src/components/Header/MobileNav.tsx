"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { pages, socialLinks, SITE_ROOT_ID, type PageKey } from "@/lib/site";

import styles from "./MobileNav.module.css";

/**
 * Every duration in the phone navigation, in one table.
 *
 * Handed to the stylesheet as custom properties on the panel (the scrim and
 * tile transitions) and read directly by the label and content swaps below,
 * which run through the Web Animations API — so no number is written twice.
 *
 *   open    scrim fades in; the two tiles lift into place 50ms apart (350ms)
 *   switch  the current words leave, the new words arrive in the SAME tiles,
 *           staggered like the reveal (~365ms); tiles and scrim do not move
 *   close   tiles and scrim go together, no stagger (260ms), then hide
 *   labels  MENU + ↔ CLOSE – / SOCIAL + ↔ CLOSE – (220ms), on every change
 */
const NAV_MOTION = {
  scrim: 300,
  tileIn: 300,
  tileStagger: 50,
  tileOut: 200,
  close: 260,
  labelSwap: 220,
  textOut: 150,
  textIn: 230,
  textInDelay: 90,
  textStagger: 45,
  /** How far a word travels as it leaves or arrives, in px. */
  shift: 6,
} as const;

const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

/** Matches the one breakpoint in MobileNav.module.css. */
const PHONE_QUERY = "(max-width: 699px)";

const FOCUSABLE = "a[href], button:not([disabled])";

const PANEL_ID = "flank-mobile-nav";
const GROUP_ID = { menu: "flank-mobile-nav-menu", social: "flank-mobile-nav-social" };

/**
 * The two things the navigation can be showing. There is one shell — one
 * scrim, one bar, one pair of tiles — and this only decides which words are
 * in it.
 */
type Mode = "menu" | "social";

/**
 * False on the server and while hydrating, true on every client render after.
 * The shell is portalled into <body>, which the server cannot render and the
 * intro's hydration must not see — so it mounts on the first render after
 * hydration, and then stays.
 */
const noSubscription = () => () => {};
const onClient = () => true;
const onServer = () => false;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Hand one word over to another in the same place: the old one rises a few
 * pixels and fades, the new one comes up from below into its position.
 *
 * Imperative on purpose. The resting states live in CSS (the inactive word is
 * simply transparent), and a swap is a one-off gesture between two of them
 * whose direction matters — which a transition on a toggled attribute cannot
 * express without the incoming word first sliding the wrong way.
 */
function swap(
  outgoing: Element[],
  incoming: Element[],
  { out, in: inDuration, delay = 0, stagger = 0 }: {
    out: number;
    in: number;
    delay?: number;
    stagger?: number;
  },
) {
  if (reducedMotion()) return;
  const shift = `${NAV_MOTION.shift}px`;
  outgoing.forEach((el, i) => {
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: `translateY(-${shift})` },
      ],
      { duration: out, delay: i * stagger, easing: EASE, fill: "backwards" },
    );
  });
  incoming.forEach((el, i) => {
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [
        { opacity: 0, transform: `translateY(${shift})` },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: inDuration,
        delay: delay + i * stagger,
        easing: EASE,
        fill: "backwards",
      },
    );
  });
}

/**
 * The phone header bar, and the navigation it opens.
 *
 * The wide header is unchanged and untouched: below 700px its four links are
 * hidden and MENU + and SOCIAL + take their place, while the wordmark between
 * them stays exactly where it was — it belongs to the header, is absolutely
 * positioned against the viewport centre, and nothing here ever moves it.
 *
 * The two marks open two different things inside ONE shell:
 *
 *   menu     CLOSE –   FLANK   SOCIAL +      HOME / ABOUT & CONTACT
 *   social   MENU +    FLANK   CLOSE –       INSTAGRAM / LINKEDIN
 *
 * The shell draws its own bar at the header's height, insets and wordmark, so
 * opening reads as the header's marks changing rather than a layer landing.
 * Pressing the other mark while open changes the mode in place: the scrim,
 * the bar, the tiles and the scroll lock all stay exactly as they are and only
 * the words move.
 *
 * The shell is mounted ONCE, hidden, right after hydration — never per open.
 * Its bar is opaque and sits exactly over the real header, so whatever
 * wordmark it carries is the only one on screen while it is up. When the
 * shell used to be created on each press, that wordmark was a brand-new <img>,
 * and WebKit does not paint a new image element in the frame it is inserted
 * (image data is resolved in a later task, from cache or not, eager or not):
 * the first frame of every open showed the white bar and its labels with no
 * FLANK in it. Mounted up front, the image has long been loaded and decoded
 * by the first press, keeps one DOM identity through every open, close and
 * switch, and opening changes nothing about it but `visibility`.
 */
export function MobileNav({ current }: { current: PageKey }) {
  const hydrated = useSyncExternalStore(noSubscription, onClient, onServer);
  /** The shell is showing — including through its close transition. Hidden
   *  (not unmounted) otherwise; see the note above. */
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  /** Which content the shell is showing. Survives closing, so the words do
   *  not change under a panel that is fading away. */
  const [mode, setMode] = useState<Mode>("menu");
  /** The page is scrolled, so the real header is not under the shell's bar
   *  and the bar has to fade rather than simply be there. */
  const [scrolled, setScrolled] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const socialButtonRef = useRef<HTMLButtonElement>(null);
  const leftRef = useRef<HTMLButtonElement>(null);
  const rightRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef(0);
  /** Which header mark started this, so focus goes back to it. */
  const originRef = useRef<HTMLButtonElement | null>(null);
  /**
   * Whether the panel is closing back onto the page that opened it.
   *
   * Dismissing it is a return: the scroll offset it froze is restored and
   * focus goes back to the mark that was pressed. Following a link out of it
   * is not — the offset belongs to the page being left, and putting it back
   * would drop the visitor partway down a page they have just arrived at,
   * while stealing focus back to a header they are no longer looking at.
   */
  const returningRef = useRef(true);

  const leftClose = open && mode === "menu";
  const rightClose = open && mode === "social";

  const openPanel = useCallback((next: Mode) => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = 0;
    returningRef.current = true;
    originRef.current =
      next === "social" ? socialButtonRef.current : menuButtonRef.current;
    setScrolled(window.scrollY > 0);
    setMode(next);
    setVisible(true);
    // Two frames: the shell is revealed in its closed state and only then told
    // to open, so the transitions have something to move from. One frame is
    // enough in Chrome and is not enough in Safari.
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  }, []);

  const close = useCallback(() => {
    returningRef.current = true;
    setOpen(false);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(
      () => {
        closeTimer.current = 0;
        setVisible(false);
      },
      reducedMotion() ? 0 : NAV_MOTION.close,
    );
  }, []);

  /**
   * Closing because a link inside the panel was followed.
   *
   * Immediate rather than faded, and deliberately so: the scroll lock has to
   * come off in the same tick the route changes, or the new page renders
   * against a body still pinned at the old page's offset.
   */
  const closeForNavigation = useCallback(() => {
    returningRef.current = false;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = 0;
    setOpen(false);
    setVisible(false);
  }, []);

  /** A bar mark inside the shell: close its own mode, or switch to it. */
  const pressBar = useCallback(
    (target: Mode) => {
      if (!open) openPanel(target);
      else if (mode === target) close();
      else {
        setMode(target);
        // The pressed mark becomes this mode's CLOSE – and keeps focus. Stated
        // rather than assumed: Safari does not focus a button on tap, and
        // focus would otherwise fall out of the dialog onto <body>.
        (target === "social" ? rightRef : leftRef).current?.focus({
          preventScroll: true,
        });
      }
    },
    [open, mode, openPanel, close],
  );

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // A viewport that grows past the breakpoint takes the bar away with it. The
  // panel must not be what is left behind — nor its scroll lock.
  useEffect(() => {
    if (!visible) return;
    const phone = window.matchMedia(PHONE_QUERY);
    const check = () => {
      if (!phone.matches) {
        setOpen(false);
        setVisible(false);
      }
    };
    phone.addEventListener("change", check);
    return () => phone.removeEventListener("change", check);
  }, [visible]);

  // ---------------------------------------------------------- document work
  //
  // The same three facts the project viewer establishes, for the same reasons
  // and in the same order: nothing behind the panel can be reached, the page
  // does not scroll underneath it, and focus goes in and comes back out.
  //
  // Keyed on `visible` alone, so switching MENU ↔ SOCIAL never releases and
  // re-takes the lock.
  useEffect(() => {
    if (!visible) return;

    const siteRoot = document.getElementById(SITE_ROOT_ID);
    siteRoot?.setAttribute("inert", "");

    // Pinning the body is the only scroll lock iOS honours, and holding the
    // exact offset is what makes closing land where the visitor left.
    const body = document.body;
    const scrollY = window.scrollY;
    const previousStyle = body.getAttribute("style");
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      siteRoot?.removeAttribute("inert");
      if (previousStyle === null) body.removeAttribute("style");
      else body.setAttribute("style", previousStyle);

      if (!returningRef.current) return;

      window.scrollTo(0, scrollY);

      // After the page behind is reachable again, never before.
      const origin = originRef.current;
      if (origin && document.contains(origin)) {
        origin.focus({ preventScroll: true });
      }
    };
  }, [visible]);

  // Focus enters on the mark that now reads CLOSE – — the control under the
  // finger or key that opened it. Switching modes does not move focus: the
  // mark that was pressed keeps it, and it is still inside the shell.
  useEffect(() => {
    if (!open) return;
    const target = mode === "social" ? rightRef.current : leftRef.current;
    target?.focus({ preventScroll: true });
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ------------------------------------------------------------------ swaps
  //
  // Layout effects, so the animation's first frame is in place before the
  // browser paints the new resting state.

  const previous = useRef({ leftClose, rightClose, mode, visible });
  useLayoutEffect(() => {
    const was = previous.current;
    previous.current = { leftClose, rightClose, mode, visible };
    // A fresh mount starts at rest; there is nothing to hand over from.
    if (!visible || !was.visible) return;

    const labels = (button: HTMLButtonElement | null) => {
      const spans = Array.from(
        button?.querySelectorAll<HTMLElement>("[data-label]") ?? [],
      );
      return {
        on: spans.filter((s) => s.dataset.active === "true"),
        off: spans.filter((s) => s.dataset.active !== "true"),
      };
    };
    const label = { out: NAV_MOTION.labelSwap, in: NAV_MOTION.labelSwap };

    if (was.leftClose !== leftClose) {
      const { on, off } = labels(leftRef.current);
      swap(off, on, label);
    }
    if (was.rightClose !== rightClose) {
      const { on, off } = labels(rightRef.current);
      swap(off, on, label);
    }

    if (was.mode !== mode) {
      const root = panelRef.current;
      const words = (m: Mode) =>
        Array.from(
          root?.querySelectorAll<HTMLElement>(
            `#${GROUP_ID[m]} [data-word]`,
          ) ?? [],
        );
      swap(words(was.mode), words(mode), {
        out: NAV_MOTION.textOut,
        in: NAV_MOTION.textIn,
        delay: NAV_MOTION.textInDelay,
        stagger: NAV_MOTION.textStagger,
      });
    }
  }, [leftClose, rightClose, mode, visible]);

  // Escape closes the whole navigation. Tab stays inside — `inert` already
  // excludes the page and the hidden mode, so this only wraps at the ends.
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => !element.closest("[inert]"));
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
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible, close]);

  /** One mark's word and sign, as a single unit. */
  const markText = (word: string, sign: string) => (
    <>
      {word}
      <span className={styles.sign} aria-hidden="true">
        {sign}
      </span>
    </>
  );

  /**
   * A bar mark with both of its states stacked in one grid cell. The cell is
   * as wide as the wider state, so SOCIAL + becoming CLOSE – never changes the
   * button's box and nothing on the bar can shift.
   */
  const barMark = (
    ref: React.RefObject<HTMLButtonElement | null>,
    side: "left" | "right",
    target: Mode,
    closing: boolean,
    word: string,
  ) => (
    <button
      ref={ref}
      type="button"
      className={styles.mark}
      data-side={side}
      onClick={() => pressBar(target)}
      aria-expanded={open && mode === target}
      aria-controls={GROUP_ID[target]}
      aria-label={closing ? `Close ${word.toLowerCase()}` : word}
    >
      <span className={styles.labels} aria-hidden="true">
        <span className={styles.label} data-label data-active={!closing}>
          {markText(word, "+")}
        </span>
        <span className={styles.label} data-label data-active={closing}>
          {markText("Close", "–")}
        </span>
      </span>
    </button>
  );

  const panel = (
    <div
      ref={panelRef}
      id={PANEL_ID}
      className={styles.panel}
      data-state={open ? "open" : "closed"}
      data-visible={visible}
      aria-hidden={visible ? undefined : true}
      data-scrolled={scrolled ? "" : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "social" ? "Social" : "Menu"}
      style={
        {
          "--nav-scrim": `${NAV_MOTION.scrim}ms`,
          "--nav-tile-in": `${NAV_MOTION.tileIn}ms`,
          "--nav-tile-stagger": `${NAV_MOTION.tileStagger}ms`,
          "--nav-tile-out": `${NAV_MOTION.tileOut}ms`,
          "--nav-close": `${NAV_MOTION.close}ms`,
          "--nav-ease": EASE,
        } as React.CSSProperties
      }
    >
      {/* The dimmed, softened page. A press on it closes, which is what a
          dimmed page means. */}
      <div
        className={styles.scrim}
        aria-hidden="true"
        onPointerDown={close}
      />

      <div className={styles.shell}>
        <div className={styles.panelBar}>
          {barMark(leftRef, "left", "menu", leftClose, "Menu")}

          {/* The official wordmark, at the width and on the centre line it has
              in the closed header. A link home, like the header's. */}
          <Link
            href="/"
            className={styles.panelLogo}
            aria-label="FLANK — home"
            onClick={closeForNavigation}
          >
            {/* Eager: the shell is hidden until pressed, and a lazy image in
                it would still be unloaded at the one moment it matters. */}
            <Image
              src="/brand/flank-wordmark-black.svg"
              alt="FLANK"
              width={1499}
              height={226}
              loading="eager"
            />
          </Link>

          {barMark(rightRef, "right", "social", rightClose, "Social")}
        </div>

        {/* Both modes occupy the same two tiles. The hidden one is inert —
            out of the tab order, out of the accessibility tree and out of hit
            testing — so there is only ever one set of destinations. */}
        <div className={styles.tiles}>
          <nav
            id={GROUP_ID.menu}
            className={styles.group}
            aria-label="Pages"
            data-active={mode === "menu"}
            inert={mode !== "menu"}
          >
            {pages.map((page, index) => (
              <Link
                key={page.key}
                href={page.href}
                className={styles.tile}
                style={{ "--i": index } as React.CSSProperties}
                aria-current={page.key === current ? "page" : undefined}
                onClick={closeForNavigation}
              >
                <span className={styles.word} data-word>
                  {page.label}
                  {page.key === current && (
                    <span className={styles.dot} aria-hidden="true" />
                  )}
                </span>
              </Link>
            ))}
          </nav>

          <nav
            id={GROUP_ID.social}
            className={styles.group}
            aria-label="Social"
            data-active={mode === "social"}
            inert={mode !== "social"}
          >
            {socialLinks.map((link, index) => (
              <a
                key={link.key}
                className={styles.tile}
                style={{ "--i": index } as React.CSSProperties}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className={styles.word} data-word>
                  {link.label}
                  <span className={styles.out} aria-hidden="true">
                    ↗
                  </span>
                </span>
              </a>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.bar}>
      <button
        ref={menuButtonRef}
        type="button"
        className={styles.mark}
        onClick={() => openPanel("menu")}
        aria-haspopup="dialog"
        aria-expanded={visible && open && mode === "menu"}
        /* Only while the shell is in the document: an aria-controls pointing
           at an id that does not exist is worse than none. */
        aria-controls={visible ? GROUP_ID.menu : undefined}
      >
        {markText("Menu", "+")}
      </button>

      <button
        ref={socialButtonRef}
        type="button"
        className={styles.mark}
        onClick={() => openPanel("social")}
        aria-haspopup="dialog"
        aria-expanded={visible && open && mode === "social"}
        aria-controls={visible ? GROUP_ID.social : undefined}
      >
        {markText("Social", "+")}
      </button>

      {/* Never in the server HTML or the hydrating render — `hydrated` is
          false for both — and present, hidden, from the render after. */}
      {hydrated && createPortal(panel, document.body)}
    </div>
  );
}
