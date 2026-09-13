/**
 * How the visitor is operating the page right now: keyboard, or pointer/touch.
 *
 * Exists for one decision only — where a dialog puts focus when it opens and
 * closes. The browser's own `:focus-visible` still decides whether any ring is
 * drawn; nothing here draws or hides one.
 *
 * Why a dialog needs to know: `:focus-visible` is well defined for focus a
 * person caused, and a guess for focus a script moved. For script focus each
 * engine infers from whatever happened to be focused before, and WebKit —
 * where a click on a link or a tap on a button focuses nothing — sometimes
 * infers "keyboard". A dialog that opened on a click and then called
 * `closeButton.focus()` would intermittently draw the keyboard ring, a square
 * around a control nobody tabbed to. So a dialog opened by pointer or touch
 * puts focus on itself (not a control, so there is nothing to ring) and one
 * opened by keyboard puts it on the first useful control, where the ring is
 * exactly right.
 *
 * Listeners are installed once, in the capture phase, the first time this
 * module is loaded on the client — which is at hydration, because the header's
 * phone navigation imports it on every page.
 */

let keyboard = false;

if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (event) => {
      // A shortcut is not navigation: cmd/ctrl/alt chords leave the modality
      // as it was.
      if (!event.metaKey && !event.ctrlKey && !event.altKey) keyboard = true;
    },
    true,
  );
  const pointer = () => {
    keyboard = false;
  };
  window.addEventListener("pointerdown", pointer, true);
  window.addEventListener("mousedown", pointer, true);
  window.addEventListener("touchstart", pointer, { capture: true, passive: true });
}

/** The most recent input that could have caused a focus change was a key. */
export function lastInputWasKeyboard(): boolean {
  return keyboard;
}

/**
 * Move focus without scrolling, telling engines that support it whether the
 * move should count as keyboard-visible. `focusVisible` is honoured by WebKit
 * and Gecko and ignored elsewhere; it is not in TypeScript's DOM types yet.
 */
export function moveFocus(element: HTMLElement): void {
  element.focus({
    preventScroll: true,
    focusVisible: keyboard,
  } as FocusOptions & { focusVisible?: boolean });
}
