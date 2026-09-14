import type { ProjectBackdrop } from "@/data/projects";

/**
 * The homepage backdrop's one piece of logic: which media is on screen, and
 * how the next one gets there.
 *
 * Two reusable layers, never more. One is FRONT (fully visible, the only one
 * allowed to be advancing at rest); the other is the STANDBY, which is where
 * the next media is prepared, invisibly, on top. Only once it can show a real
 * frame does it fade in over the front — which stays at full opacity beneath,
 * so the crossfade has no luminance dip — and then the old front is paused and
 * becomes the standby. It keeps its source, so going straight back to it is
 * instant: no refetch, no restart.
 *
 *   idle        nothing on the layers yet; the static poster underneath shows
 *   loading     the standby is preparing `target` (its still takes over if
 *               the video is slow — see POSTER_GRACE_MS)
 *   crossfading the standby is fading in; never interrupted
 *   active      front shows `target`
 *
 * The latest target always wins. A load is identified by a token and every
 * async continuation checks it, so a slow video that was asked for three
 * hovers ago can never surface. A crossfade is never cut short: a newer target
 * is reconciled the moment it lands, which is at most one fade away.
 *
 * Plain TypeScript and no React state: hover moves nothing in the React tree.
 */

export const BACKDROP_FADE_MS = 360;

/** A pointer must rest on a card this long before its media is asked for — a
 *  sweep across the mosaic passes through cards faster than this and fetches
 *  nothing on the way. */
const ENTER_INTENT_MS = 120;

/** Leaving a card waits this long before returning to the default, so
 *  crossing a 4px gutter into the next card never goes project → default →
 *  project. */
const LEAVE_INTENT_MS = 160;

/** How long the outgoing media is held while an incoming video prepares.
 *  Cached and nearby files are presenting well inside this; past it the
 *  network is slow, and the incoming project's still takes over. */
const POSTER_GRACE_MS = 700;

/** Scroll mode: how long a card must keep the backdrop before its film is
 *  loaded over its still. Scrolling through the page costs no video at all;
 *  staying with a piece of work brings it to life. */
const LINGER_MS = 1000;

/**
 * Which input is allowed to choose the backdrop. Exactly one, from device
 * capability — never from width:
 *
 *   hover   a real hover + fine pointer: the card under the pointer
 *   scroll  touch-first: the dominant card while scrolling (scrollDominance.ts)
 *   static  reduced motion: the default still, and nothing switches
 */
export type BackdropMode = "hover" | "scroll" | "static";

export interface BackdropCapabilities {
  videoAllowed: boolean;
  mode: BackdropMode;
}

export interface BackdropLayer {
  root: HTMLElement;
  video: HTMLVideoElement;
  image: HTMLImageElement;
}

type Phase = "idle" | "loading" | "crossfading" | "active";
type Role = "front" | "standby" | "incoming" | "fading";

interface LayerState extends BackdropLayer {
  /** What the layer's elements currently hold — kept after it goes standby. */
  media: ProjectBackdrop | null;
  kind: "video" | "image" | null;
  /** The video file this layer has actually presented frames of. Only that
   *  one is worth keeping loaded while the layer waits in standby. */
  presented: string | null;
  /** Showing a still whose film is waiting for the visitor to linger. */
  lingering: boolean;
}

export class HomeBackdropController {
  private layers: [LayerState, LayerState] | null = null;
  private front = -1;
  private phase: Phase = "idle";
  private target: ProjectBackdrop | null = null;
  private token = 0;
  private abort: AbortController | null = null;
  private fadeTimer = 0;
  private enterTimer = 0;
  private graceTimer = 0;
  private leaveTimer = 0;
  private lingerTimer = 0;
  /** The current target arrived by scrolling: show its still first. */
  private stillFirst = false;
  /** A key whose last load failed; not retried until the target changes. */
  private failedKey: string | null = null;
  private suspended = { hidden: false, viewer: false };
  private videoAllowed = false;
  private currentMode: BackdropMode = "static";
  private modeListeners = new Set<(mode: BackdropMode) => void>();
  private retryArmed = false;

  constructor(private readonly fallback: ProjectBackdrop | undefined) {}

  /* ------------------------------------------------------------- lifecycle */

  attach(
    layers: [BackdropLayer, BackdropLayer],
    capabilities: BackdropCapabilities,
  ): void {
    this.layers = layers.map((layer) => ({
      ...layer,
      media: null,
      kind: null,
      presented: null,
      lingering: false,
    })) as [LayerState, LayerState];
    this.front = -1;
    this.phase = "idle";
    this.setCapabilities(capabilities);
    for (const layer of this.layers) this.setRole(layer, "standby");
  }

  detach(): void {
    this.cancelLoad();
    window.clearTimeout(this.fadeTimer);
    window.clearTimeout(this.enterTimer);
    window.clearTimeout(this.leaveTimer);
    window.clearTimeout(this.graceTimer);
    window.clearTimeout(this.lingerTimer);
    window.removeEventListener("pointerup", this.retryOnGesture);
    for (const layer of this.layers ?? []) layer.video.pause();
    this.layers = null;
    this.target = null;
    this.phase = "idle";
    this.front = -1;
  }

  /** The default source may start (the mosaic's stills have landed). */
  start(): void {
    if (!this.layers || this.target) return;
    this.stillFirst = false;
    this.target = this.fallback ?? null;
    this.reconcile();
  }

  setCapabilities(next: BackdropCapabilities): void {
    this.videoAllowed = next.videoAllowed;
    if (next.mode !== this.currentMode) {
      // A change of input starts over from the default: nothing chosen by the
      // old input survives into the new one.
      this.currentMode = next.mode;
      this.clearIntent();
      this.setTarget(this.fallback ?? null);
      for (const listener of this.modeListeners) listener(next.mode);
    }
    this.syncPlayback();
  }

  get mode(): BackdropMode {
    return this.currentMode;
  }

  /** Called with the new mode whenever it changes. Returns the unsubscribe. */
  subscribeMode(listener: (mode: BackdropMode) => void): () => void {
    this.modeListeners.add(listener);
    return () => {
      this.modeListeners.delete(listener);
    };
  }

  setSuspended(reason: "hidden" | "viewer", on: boolean): void {
    if (this.suspended[reason] === on) return;
    this.suspended[reason] = on;
    if (!on) this.failedKey = null;
    this.syncPlayback();
    if (!on) this.reconcile();
  }

  /* ----------------------------------------------------------------- hover */

  /** A card asked for its media. Ignored where hover is not a real input. */
  hover(media: ProjectBackdrop): void {
    if (this.currentMode !== "hover" || !this.layers) return;
    window.clearTimeout(this.leaveTimer);
    window.clearTimeout(this.enterTimer);
    this.enterTimer = window.setTimeout(() => {
      this.stillFirst = false;
      this.setTarget(media);
    }, ENTER_INTENT_MS);
  }

  /** The card was left. Resolved to the default unless another card is
   *  entered first. */
  leave(): void {
    if (this.currentMode !== "hover" || !this.layers) return;
    window.clearTimeout(this.enterTimer);
    window.clearTimeout(this.leaveTimer);
    this.leaveTimer = window.setTimeout(() => {
      this.stillFirst = false;
      this.setTarget(this.fallback ?? null);
    }, LEAVE_INTENT_MS);
  }

  /* ---------------------------------------------------------------- scroll */

  /**
   * The dominant card while scrolling. No intent delay here: the selector has
   * already waited for the choice to be stable, and owns the hysteresis.
   *
   * Still first: the card's poster — already loaded by the card itself —
   * crossfades in at once, and its film follows only after LINGER_MS. On a
   * phone that keeps a scroll through the work free of backdrop downloads and
   * decoding (WebKit refetches a file on every source change), and leaves the
   * device's video budget to the previews while the visitor is moving.
   */
  select(media: ProjectBackdrop): void {
    if (this.currentMode !== "scroll" || !this.layers) return;
    this.stillFirst = true;
    this.setTarget(media);
  }

  /** Straight to a target with no intent delay — used when the page state,
   *  not the input, decides (the viewer closing). `null` is the default. */
  resolve(media: ProjectBackdrop | null): void {
    if (!this.layers) return;
    this.clearIntent();
    this.stillFirst = this.currentMode === "scroll";
    this.setTarget(
      media && this.currentMode !== "static" ? media : (this.fallback ?? null),
    );
  }

  private clearIntent(): void {
    window.clearTimeout(this.enterTimer);
    window.clearTimeout(this.leaveTimer);
  }

  /* ---------------------------------------------------------- the machine */

  private setTarget(media: ProjectBackdrop | null): void {
    if (!this.target) return; // not started: the default has not been released
    if (!media || media.key === this.target.key) return;
    this.target = media;
    this.failedKey = null;
    this.reconcile();
  }

  private reconcile(): void {
    const layers = this.layers;
    const target = this.target;
    if (!layers || !target) return;
    if (this.phase === "crossfading") return; // picked up when the fade lands
    if (this.suspended.viewer || this.suspended.hidden) return;

    const front = this.front >= 0 ? layers[this.front] : null;
    if (front?.media?.key === target.key) {
      // Already showing it: nothing restarts, nothing fades.
      if (this.phase === "loading") this.cancelLoad();
      this.phase = "active";
      this.armLinger();
      return;
    }
    if (target.key === this.failedKey) return;
    const standby = layers[this.standbyIndex()];
    if (this.phase === "loading" && standby.media?.key === target.key) return;

    this.load(target);
  }

  private standbyIndex(): number {
    return this.front === 0 ? 1 : 0;
  }

  private load(media: ProjectBackdrop): void {
    const layers = this.layers!;
    this.cancelLoad();
    const token = ++this.token;
    const abort = new AbortController();
    this.abort = abort;
    const index = this.standbyIndex();
    const layer = layers[index];
    window.clearTimeout(this.lingerTimer);
    this.phase = "loading";
    this.setRole(layer, "incoming");
    this.setVideoShown(layer, false);

    // A film this layer has already presented is ready now: no still needed.
    const reusable =
      Boolean(media.video) &&
      layer.presented === media.video &&
      layer.video.getAttribute("src") === media.video;
    layer.media = media;
    layer.lingering = false;

    const failed = () => {
      this.failedKey = media.key;
      this.phase = this.front >= 0 ? "active" : "idle";
      this.setRole(layer, "standby");
    };

    const stillFirst =
      this.stillFirst && Boolean(media.video) && this.videoAllowed && !reusable;
    if (!media.video || !this.videoAllowed || (stillFirst && media.image)) {
      layer.kind = layer.root.dataset.kind = "image";
      layer.lingering = stillFirst;
      this.releaseUnpresented(layer);
      this.decodeImage(layer, media).then((ok) => {
        if (token !== this.token) return; // superseded: never surfaces
        if (ok) this.crossfade(index);
        else failed();
      });
      return;
    }

    layer.kind = layer.root.dataset.kind = "video";
    let onPoster = false;

    // Continuity first: the outgoing media stays up while the incoming video
    // prepares. Only when that is slow does the incoming still take over — so
    // a slow network shows the right project rather than a stale one — and
    // the video then fades in over its own still inside the same layer.
    window.clearTimeout(this.graceTimer);
    this.graceTimer = window.setTimeout(() => {
      this.decodeImage(layer, media).then((ok) => {
        if (!ok || token !== this.token || this.phase !== "loading") return;
        onPoster = true;
        this.crossfade(index);
      });
    }, POSTER_GRACE_MS);

    this.prepareVideo(layer, media, abort.signal).then((ok) => {
      window.clearTimeout(this.graceTimer);
      if (token !== this.token) return;
      if (!ok) {
        if (!onPoster) failed();
        return;
      }
      layer.presented = media.video!;
      this.setVideoShown(layer, true);
      if (!onPoster) this.crossfade(index);
    });
  }

  /**
   * Scroll mode: once the front still has held for LINGER_MS, load its film
   * into the same layer and fade it in over the still. Superseded by any new
   * load (the token), and re-armed whenever the machine confirms the front.
   */
  private armLinger(): void {
    window.clearTimeout(this.lingerTimer);
    const layers = this.layers;
    if (!layers || this.front < 0) return;
    const index = this.front;
    const layer = layers[index];
    const media = layer.media;
    if (!layer.lingering || !media?.video || !this.videoAllowed) return;
    const token = this.token;
    this.lingerTimer = window.setTimeout(() => {
      if (
        token !== this.token ||
        this.front !== index ||
        layer.media !== media ||
        this.suspended.hidden ||
        this.suspended.viewer
      ) {
        return;
      }
      layer.lingering = false;
      layer.kind = layer.root.dataset.kind = "video";
      const abort = new AbortController();
      this.abort = abort;
      this.prepareVideo(layer, media, abort.signal).then((ok) => {
        if (token !== this.token || !ok) return;
        layer.presented = media.video!;
        this.setVideoShown(layer, true);
      });
    }, LINGER_MS);
  }

  private cancelLoad(): void {
    this.token++;
    window.clearTimeout(this.graceTimer);
    this.abort?.abort();
    this.abort = null;
    if (this.phase !== "loading" || !this.layers) return;
    const standby = this.layers[this.standbyIndex()];
    this.releaseUnpresented(standby);
    this.setRole(standby, "standby");
    this.phase = this.front >= 0 ? "active" : "idle";
  }

  private crossfade(index: number): void {
    const layers = this.layers!;
    const incoming = layers[index];
    const outgoing = this.front >= 0 ? layers[this.front] : null;
    this.phase = "crossfading";
    this.setRole(incoming, "fading");

    window.clearTimeout(this.fadeTimer);
    this.fadeTimer = window.setTimeout(() => {
      if (!this.layers) return;
      this.setRole(incoming, "front");
      if (outgoing) {
        this.setRole(outgoing, "standby");
        this.releaseUnpresented(outgoing);
      }
      this.front = index;
      this.phase = "active";
      this.syncPlayback();
      this.reconcile();
    }, BACKDROP_FADE_MS + 40);
  }

  /* ------------------------------------------------------------ the media */

  /**
   * Pause a layer's video, and if it never presented a frame, drop its source
   * so an abandoned download stops competing with what is wanted now. A video
   * that has been on screen keeps its buffer: returning to it is instant.
   */
  private releaseUnpresented(layer: LayerState): void {
    const video = layer.video;
    if (!video.paused) video.pause();
    const src = video.getAttribute("src");
    if (src && src !== layer.presented) {
      video.removeAttribute("src");
      video.load();
    }
  }

  /** Put the media's still in the layer and resolve once it is decoded. Only
   *  called when the still is actually needed — a still project, or a slow
   *  video — so a fast video never costs an extra image decode. */
  private decodeImage(
    layer: LayerState,
    media: ProjectBackdrop,
  ): Promise<boolean> {
    if (!media.image) return Promise.resolve(false);
    layer.image.style.objectPosition = media.position;
    if (layer.image.getAttribute("src") !== media.image) {
      layer.image.src = media.image;
    }
    return layer.image
      .decode()
      .then(() => true)
      .catch(() => layer.image.complete && layer.image.naturalWidth > 0);
  }

  private setVideoShown(layer: BackdropLayer, on: boolean): void {
    layer.root.dataset.video = on ? "shown" : "hidden";
  }

  /**
   * Resolves true once the layer's video is presenting advancing frames — not
   * on `loadeddata`, which a paused or stalled element can report with
   * nothing to show. An aborted signal settles nothing: the token check is
   * what discards it, and its listeners are gone.
   */
  private prepareVideo(
    layer: LayerState,
    media: ProjectBackdrop,
    signal: AbortSignal,
  ): Promise<boolean> {
    const video = layer.video;
    video.style.objectPosition = media.position;
    // The same file already in this layer is reused as it is: no refetch,
    // no restart.
    if (video.getAttribute("src") !== media.video) {
      video.preload = "auto";
      video.src = media.video!;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (ok: boolean) => {
        if (settled || signal.aborted) return;
        settled = true;
        resolve(ok);
      };
      const startTime = video.currentTime;
      const onProgress = () => {
        if (video.readyState >= 2 && !video.paused && video.currentTime !== startTime) {
          settle(true);
        }
      };
      const onPlaying = () => {
        // The first presented frame, where the engine can tell us; otherwise
        // the clock moving is the proof.
        video.requestVideoFrameCallback?.(() => settle(true));
      };
      video.addEventListener("timeupdate", onProgress, { signal });
      video.addEventListener("playing", onPlaying, { signal });
      video.addEventListener("error", () => settle(false), { signal });
      this.play(video, () => settle(false));
      if (!video.paused && video.readyState >= 2) onPlaying();
    });
  }

  private play(video: HTMLVideoElement, onRefused?: () => void): void {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.play().catch((error: unknown) => {
      // Our own pause() superseding a request is not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      onRefused?.();
      if (
        error instanceof DOMException &&
        error.name === "NotAllowedError" &&
        !this.retryArmed
      ) {
        // Low Power Mode and friends: stay on what is showing, and let the
        // first real gesture try once more.
        this.retryArmed = true;
        window.addEventListener("pointerup", this.retryOnGesture, {
          once: true,
          passive: true,
        });
      }
    });
  }

  private retryOnGesture = () => {
    this.retryArmed = false;
    this.failedKey = null;
    this.syncPlayback();
    this.reconcile();
  };

  /** Exactly the front video may advance at rest, and only when it can be
   *  seen. A loading standby is driven by its own load. */
  private syncPlayback(): void {
    if (!this.layers) return;
    const suspended = this.suspended.hidden || this.suspended.viewer;
    this.layers.forEach((layer, index) => {
      const isFront = index === this.front;
      const loading = this.phase === "loading" && index === this.standbyIndex();
      const wanted =
        layer.kind === "video" &&
        this.videoAllowed &&
        !suspended &&
        (isFront || loading || this.phase === "crossfading");
      if (!wanted) {
        if (!layer.video.paused) layer.video.pause();
      } else if (layer.video.paused && layer.video.getAttribute("src")) {
        this.play(layer.video);
      }
    });
  }

  private setRole(layer: BackdropLayer, role: Role): void {
    layer.root.dataset.role = role;
  }
}
