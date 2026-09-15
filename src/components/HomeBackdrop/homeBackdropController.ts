import type { ProjectBackdrop } from "@/data/projects";

/**
 * The homepage backdrop's one piece of logic: which project is behind the
 * framed site, and how the next one gets there.
 *
 * ONE AUTHORITY. `desired` is the project the input asked for (hover, the
 * dominant card while scrolling, the viewer closing, the default). Every
 * decision resolves against it, and nothing else can put a picture on screen.
 *
 * TWO LAYERS, EACH WITH AN IDENTITY. A layer holds exactly one project at a
 * time (`media`) and a generation number (`gen`) that changes every time it is
 * given a project. Its still is always THAT project's still and its film always
 * THAT project's film, so a layer can never show one project's picture under
 * another's name. Every asynchronous continuation — an image decode, a media
 * event, a frame callback, a timer — carries the generation it was started for
 * and is a complete no-op if the layer has moved on or no longer owns
 * `desired`. A late event from an old source cannot surface.
 *
 *   front     the visible layer (opaque)
 *   incoming  the other layer, preparing `desired` invisibly on top, then
 *             fading in over the front — which stays opaque underneath, so
 *             there is no luminance dip — and becoming the front
 *
 * WHAT A LAYER SHOWS is one value, `show`:
 *
 *   none   nothing yet
 *   still  its project's still
 *   film   its project's film, over its still — set only from the element's
 *          own frame signals (a presented frame where the engine reports one,
 *          otherwise playing with a decoded frame), and only while the layer
 *          owns `desired`
 *
 * TIMING. Nothing waits that does not have to:
 *   desktop  hover intent (ENTER_INTENT_MS), then the target is prepared at
 *            once. If its film presents a frame within STILL_AFTER_MS it fades
 *            straight in; otherwise its own still fades in and the film follows
 *            over it the moment it is ready.
 *   scroll   the still at once; the film only after LINGER_MS on the card.
 *
 * PLAYBACK is decided in one place (syncPlayback) and defended: a film the
 * controller wants playing that the browser pauses is asked again, and a start
 * that stalls is reloaded where it was. A frozen front frame cannot persist.
 *
 * Plain TypeScript and no React state: hover moves nothing in the React tree.
 */

export const BACKDROP_FADE_MS = 360;

/** A pointer must rest on a card this long before its media is asked for — a
 *  sweep across the mosaic passes through cards faster than this. */
const ENTER_INTENT_MS = 120;

/** Leaving a card waits this long before returning to the default, so
 *  crossing a 4px gutter into the next card never goes project → default →
 *  project. */
const LEAVE_INTENT_MS = 160;

/** Desktop: the outgoing picture is held this long for the incoming film.
 *  A cached or nearby film presents well inside it and crossfades straight
 *  in; past it, the incoming project's own still stands in immediately. */
const STILL_AFTER_MS = 160;

/** Scroll mode: how long a card must keep the backdrop before its film is
 *  loaded over its still. Scrolling through the work costs no video. */
const LINGER_MS = 1000;

/** A wanted film that has neither advanced nor received a single byte for
 *  this long is reloaded where it was — WebKit can otherwise hold a start
 *  indefinitely. A download that is merely slow is never restarted. */
const STALL_MS = 3000;
const STALL_RELOADS = 2;

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

type Show = "none" | "still" | "film";
type Role = "front" | "standby" | "incoming" | "fading";

interface Layer extends BackdropLayer {
  /** The project this layer holds. Its identity; null when released. */
  media: ProjectBackdrop | null;
  /** Changes on every assignment; async work carries the value it began with. */
  gen: number;
  show: Show;
  /** Its film should be loading/playing (false for stills and while lingering). */
  filmWanted: boolean;
  /** Showing its still while its film waits for the visitor to linger. */
  lingering: boolean;
  stillReady: boolean;
  stillDue: boolean;
  /** A film file this layer has presented frames of: kept loaded in standby,
   *  so returning to it is instant. */
  presented: string | null;
  stallTimer: number;
  stallReloads: number;
  stillTimer: number;
  lingerTimer: number;
  frameRequested: number;
  /** When the element last reported bytes arriving (`progress`). */
  progressAt: number;
  /** When a browser-initiated pause was last answered — at most once a second,
   *  so a browser that insists cannot become a play/pause loop. */
  resumedAt: number;
}

export class HomeBackdropController {
  private layers: [Layer, Layer] | null = null;
  private front: Layer | null = null;
  private incoming: Layer | null = null;
  private fading = false;
  private fadeTimer = 0;

  /** The one authority. Null until the default is released. */
  private desired: ProjectBackdrop | null = null;
  /** `desired` arrived by scrolling: its still comes first, its film lingers. */
  private stillFirst = false;

  private enterTimer = 0;
  private leaveTimer = 0;
  private lifetime: AbortController | null = null;
  private suspended = { hidden: false, viewer: false };
  private videoAllowed = false;
  private currentMode: BackdropMode = "static";
  private modeListeners = new Set<(mode: BackdropMode) => void>();
  private retryArmed = false;

  constructor(private readonly fallback: ProjectBackdrop | undefined) {}

  /* ------------------------------------------------------------- lifecycle */

  attach(layers: [BackdropLayer, BackdropLayer], capabilities: BackdropCapabilities): void {
    this.lifetime?.abort();
    const lifetime = new AbortController();
    this.lifetime = lifetime;
    this.layers = layers.map((layer) => ({
      ...layer,
      media: null,
      gen: 0,
      show: "none",
      filmWanted: false,
      lingering: false,
      stillReady: false,
      stillDue: false,
      presented: null,
      stallTimer: 0,
      stallReloads: 0,
      stillTimer: 0,
      lingerTimer: 0,
      frameRequested: -1,
      resumedAt: 0,
      progressAt: 0,
    })) as [Layer, Layer];
    this.front = null;
    this.incoming = null;
    this.fading = false;
    this.setCapabilities(capabilities);

    for (const layer of this.layers) {
      this.setRole(layer, "standby");
      this.render(layer);
      const { video } = layer;
      const on = (type: string, handler: () => void) =>
        video.addEventListener(type, handler, { signal: lifetime.signal });
      // Frame signals: a film is revealed from what the element reports, never
      // from a load's bookkeeping.
      for (const type of ["loadeddata", "canplay", "playing"]) {
        on(type, () => this.onFilmSignal(layer));
      }
      // A clock that moves after a stall clears the stall.
      on("timeupdate", () => this.clearStall(layer));
      on("progress", () => {
        layer.progressAt = performance.now();
      });
      on("waiting", () => this.armStall(layer));
      on("stalled", () => this.armStall(layer));
      on("pause", () => this.onBrowserPause(layer));
    }
  }

  detach(): void {
    this.lifetime?.abort();
    this.lifetime = null;
    window.clearTimeout(this.fadeTimer);
    this.clearIntent();
    window.removeEventListener("pointerup", this.retryOnGesture);
    for (const layer of this.layers ?? []) {
      this.clearLayerTimers(layer);
      layer.gen++;
      this.pauseVideo(layer);
    }
    this.layers = null;
    this.front = null;
    this.incoming = null;
    this.fading = false;
    this.desired = null;
  }

  /** The default may start (the mosaic's stills have landed). */
  start(): void {
    if (!this.layers || this.desired) return;
    this.stillFirst = false;
    this.desired = this.fallback ?? null;
    this.evaluate();
  }

  setCapabilities(next: BackdropCapabilities): void {
    this.videoAllowed = next.videoAllowed;
    if (next.mode !== this.currentMode) {
      // A change of input starts over from the default: nothing chosen by the
      // old input survives into the new one.
      this.currentMode = next.mode;
      this.clearIntent();
      this.setDesired(this.fallback ?? null, false);
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
    this.syncPlayback();
    if (!on) this.evaluate();
  }

  /* ---------------------------------------------------------------- inputs */

  /** A card asked for its media. Ignored where hover is not a real input. */
  hover(media: ProjectBackdrop): void {
    if (this.currentMode !== "hover" || !this.layers) return;
    this.clearIntent();
    this.enterTimer = window.setTimeout(
      () => this.setDesired(media, false),
      ENTER_INTENT_MS,
    );
  }

  /** The card was left. Resolved to the default unless another card is
   *  entered first. */
  leave(): void {
    if (this.currentMode !== "hover" || !this.layers) return;
    this.clearIntent();
    this.leaveTimer = window.setTimeout(
      () => this.setDesired(this.fallback ?? null, false),
      LEAVE_INTENT_MS,
    );
  }

  /**
   * The dominant card while scrolling. The selector has already waited for the
   * choice to be stable and owns the hysteresis. Still first, film on linger.
   */
  select(media: ProjectBackdrop): void {
    if (this.currentMode !== "scroll" || !this.layers) return;
    this.setDesired(media, true);
  }

  /** Straight to a target with no intent delay — the page state decides (the
   *  viewer closing). `null` is the default. */
  resolve(media: ProjectBackdrop | null): void {
    if (!this.layers) return;
    this.clearIntent();
    this.setDesired(
      media && this.currentMode !== "static" ? media : (this.fallback ?? null),
      this.currentMode === "scroll",
    );
  }

  private clearIntent(): void {
    window.clearTimeout(this.enterTimer);
    window.clearTimeout(this.leaveTimer);
  }

  /* ---------------------------------------------------------- the machine */

  private setDesired(media: ProjectBackdrop | null, stillFirst: boolean): void {
    if (!this.desired || !media) return; // not started yet
    if (media.key === this.desired.key) return;
    this.desired = media;
    this.stillFirst = stillFirst;
    this.evaluate();
  }

  /** Does this layer hold the project the input currently wants? */
  private owns(layer: Layer | null): layer is Layer {
    return Boolean(layer?.media && this.desired && layer.media.key === this.desired.key);
  }

  /** Bring the layers towards `desired`. Safe to call at any time. */
  private evaluate(): void {
    const layers = this.layers;
    const desired = this.desired;
    if (!layers || !desired) return;
    if (this.suspended.hidden || this.suspended.viewer || this.fading) {
      // A fade always lands; suspension resumes here.
      this.syncPlayback();
      return;
    }

    if (this.owns(this.front)) {
      // Already showing it: nothing restarts and nothing fades. Anything that
      // was being prepared for another project is abandoned.
      if (this.incoming) this.abandon(this.incoming);
      this.incoming = null;
      this.armLinger(this.front);
      this.syncPlayback();
      return;
    }

    if (this.owns(this.incoming)) {
      this.syncPlayback();
      this.maybeFade(this.incoming);
      return;
    }

    const layer = this.incoming ?? (this.front === layers[0] ? layers[1] : layers[0]);
    this.assign(layer, desired);
  }

  /** Give a layer a project. Everything it held before is invalidated. */
  private assign(layer: Layer, media: ProjectBackdrop): void {
    this.clearLayerTimers(layer);
    const gen = ++layer.gen;
    const reusable =
      Boolean(media.video) &&
      layer.presented === media.video &&
      layer.video.getAttribute("src") === media.video;

    layer.media = media;
    layer.stillReady = false;
    layer.stillDue = false;
    layer.stallReloads = 0;
    this.incoming = layer;
    this.setRole(layer, "incoming");
    this.setShow(layer, "none");

    // Its own still, always — the only still that may ever sit in this layer.
    layer.image.style.objectPosition = media.position;
    if (media.image) {
      if (layer.image.getAttribute("src") !== media.image) layer.image.src = media.image;
      layer.image
        .decode()
        .catch(() => undefined)
        .then(() => {
          if (layer.gen !== gen || layer.image.getAttribute("src") !== media.image) return;
          if (!layer.image.complete || layer.image.naturalWidth === 0) return;
          layer.stillReady = true;
          this.tryStill(layer, gen);
        });
    } else {
      layer.image.removeAttribute("src");
    }

    // Its own film.
    const film = Boolean(media.video) && this.videoAllowed;
    layer.lingering = film && this.stillFirst && !reusable && Boolean(media.image);
    layer.filmWanted = film && !layer.lingering;
    if (layer.filmWanted) {
      layer.video.style.objectPosition = media.position;
      if (layer.video.getAttribute("src") !== media.video) {
        layer.video.preload = "auto";
        layer.video.src = media.video!;
      }
    } else {
      this.release(layer);
    }

    // When may its still stand in? Stills and lingering films: at once.
    // Films: after the short hold, if no frame has come by then.
    const hold = layer.filmWanted ? STILL_AFTER_MS : 0;
    layer.stillTimer = window.setTimeout(() => {
      if (layer.gen !== gen) return;
      layer.stillDue = true;
      this.tryStill(layer, gen);
    }, hold);

    this.syncPlayback();
    if (layer.filmWanted) this.onFilmSignal(layer);
  }

  /** A layer's still may now be what it shows. */
  private tryStill(layer: Layer, gen: number): void {
    if (layer.gen !== gen || !this.owns(layer)) return;
    if (!layer.stillReady || !layer.stillDue || layer.show !== "none") return;
    this.setShow(layer, "still");
    if (layer === this.front) this.armLinger(layer);
    this.maybeFade(layer);
  }

  /**
   * The film authority. Called on the element's own signals; a film is shown
   * only when it is this layer's current file, the layer owns `desired`, and
   * the element is playing with a decoded frame. Where the engine can report a
   * presented frame, that is waited for too.
   */
  private onFilmSignal(layer: Layer): void {
    const { video, media } = layer;
    const gen = layer.gen;
    if (!media?.video || !layer.filmWanted || video.getAttribute("src") !== media.video) return;
    if (!this.owns(layer) || (layer !== this.front && layer !== this.incoming)) return;
    if (video.paused || video.readyState < 2) return;

    const reveal = () => {
      if (layer.gen !== gen || !this.owns(layer) || !layer.filmWanted) return;
      if (video.getAttribute("src") !== media.video || video.readyState < 2) return;
      layer.presented = media.video!;
      this.clearStall(layer);
      if (layer.show !== "film") this.setShow(layer, "film");
      this.maybeFade(layer);
    };

    if (typeof video.requestVideoFrameCallback === "function") {
      if (layer.frameRequested === gen) return; // one frame request per assignment
      layer.frameRequested = gen;
      video.requestVideoFrameCallback(() => {
        if (layer.frameRequested === gen) layer.frameRequested = -1;
        reveal();
      });
    } else {
      reveal();
    }
  }

  /** Fade the incoming layer in once it has something of its own to show. */
  private maybeFade(layer: Layer): void {
    if (layer !== this.incoming || this.fading || !this.owns(layer)) return;
    if (layer.show === "none") return;
    if (this.suspended.hidden || this.suspended.viewer) return;

    const outgoing = this.front;
    const gen = layer.gen;
    this.fading = true;
    this.setRole(layer, "fading");
    this.syncPlayback();

    window.clearTimeout(this.fadeTimer);
    this.fadeTimer = window.setTimeout(() => {
      this.fading = false;
      if (!this.layers) return;
      this.setRole(layer, "front");
      this.front = layer;
      if (this.incoming === layer) this.incoming = null;
      if (outgoing && outgoing !== layer) {
        this.setRole(outgoing, "standby");
        this.setShow(outgoing, "none");
        outgoing.lingering = false;
        this.clearLayerTimers(outgoing);
        outgoing.gen++;
        outgoing.media = null;
        this.release(outgoing);
      }
      if (layer.gen === gen) this.armLinger(layer);
      this.evaluate();
    }, BACKDROP_FADE_MS + 40);
  }

  /** Stop preparing a layer: its callbacks become no-ops, nothing of it shows. */
  private abandon(layer: Layer): void {
    this.clearLayerTimers(layer);
    layer.gen++;
    layer.media = null;
    layer.lingering = false;
    layer.filmWanted = false;
    this.setRole(layer, "standby");
    this.setShow(layer, "none");
    this.release(layer);
  }

  /**
   * Scroll mode: once the front still has held for LINGER_MS, load its film
   * into the same layer; it fades in over the still on its first frame.
   */
  private armLinger(layer: Layer): void {
    window.clearTimeout(layer.lingerTimer);
    if (!layer.lingering || !layer.media?.video || !this.videoAllowed) return;
    if (layer !== this.front || layer.show !== "still") return;
    const gen = layer.gen;
    const media = layer.media;
    layer.lingerTimer = window.setTimeout(() => {
      if (layer.gen !== gen || layer !== this.front || !this.owns(layer)) return;
      if (this.suspended.hidden || this.suspended.viewer) return;
      layer.lingering = false;
      layer.filmWanted = true;
      layer.video.style.objectPosition = media.position;
      if (layer.video.getAttribute("src") !== media.video) {
        layer.video.preload = "auto";
        layer.video.src = media.video!;
      }
      this.syncPlayback();
      this.onFilmSignal(layer);
    }, LINGER_MS);
  }

  /* ------------------------------------------------------------- playback */

  /**
   * The only place that decides what plays:
   *   front     its film, if that film is showing, or is wanted and owns desired
   *   incoming  its film while it prepares for (and owns) desired
   * Everything else is paused. Nothing plays while hidden or under the viewer.
   */
  private syncPlayback(): void {
    if (!this.layers) return;
    const suspended = this.suspended.hidden || this.suspended.viewer;
    for (const layer of this.layers) {
      const src = layer.video.getAttribute("src");
      const current = Boolean(src && layer.media?.video === src);
      const wanted =
        this.videoAllowed &&
        !suspended &&
        current &&
        ((layer === this.front &&
          (layer.show === "film" || (layer.filmWanted && this.owns(layer)))) ||
          (layer === this.incoming && layer.filmWanted && this.owns(layer)));
      if (wanted) {
        if (layer.video.paused) this.play(layer);
      } else {
        this.clearStall(layer);
        if (!layer.video.paused) this.pauseVideo(layer);
      }
    }
  }

  private isWanted(layer: Layer): boolean {
    if (!this.videoAllowed || this.suspended.hidden || this.suspended.viewer) return false;
    const src = layer.video.getAttribute("src");
    if (!src || layer.media?.video !== src) return false;
    if (layer === this.front) return layer.show === "film" || (layer.filmWanted && this.owns(layer));
    return layer === this.incoming && layer.filmWanted && this.owns(layer);
  }

  private play(layer: Layer): void {
    const { video } = layer;
    const gen = layer.gen;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.play().then(
      () => {
        if (layer.gen === gen) this.onFilmSignal(layer);
      },
      (error: unknown) => {
        // Superseded by our own pause or a source change: not a failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (
          error instanceof DOMException &&
          error.name === "NotAllowedError" &&
          !this.retryArmed
        ) {
          // Low Power Mode and friends: the still stays, and the first real
          // gesture tries once more.
          this.retryArmed = true;
          window.addEventListener("pointerup", this.retryOnGesture, {
            once: true,
            passive: true,
          });
        }
      },
    );
  }

  private pauseVideo(layer: Layer): void {
    layer.video.pause();
  }

  /**
   * A pause the controller did not want — the browser's (a decoder, a power
   * policy, a stalled loop). Our own pauses only ever happen to films that
   * are no longer wanted, so `isWanted` alone tells them apart: ask again.
   */
  private onBrowserPause(layer: Layer): void {
    if (!this.isWanted(layer)) return;
    const now = performance.now();
    if (now - layer.resumedAt < 1000) return;
    layer.resumedAt = now;
    const gen = layer.gen;
    window.setTimeout(() => {
      if (layer.gen === gen && layer.video.paused && this.isWanted(layer)) this.play(layer);
    }, 0);
  }

  private armStall(layer: Layer): void {
    if (layer.stallTimer || !this.isWanted(layer)) return;
    const gen = layer.gen;
    const at = layer.video.currentTime;
    const armedAt = performance.now();
    layer.stallTimer = window.setTimeout(() => {
      layer.stallTimer = 0;
      if (layer.gen !== gen || !this.isWanted(layer)) return;
      if (layer.video.currentTime !== at || layer.stallReloads >= STALL_RELOADS) return;
      // Bytes still arriving: slow, not stuck. Keep waiting.
      if (layer.progressAt > armedAt) {
        this.armStall(layer);
        return;
      }
      // Reload where it was: the one reliable way out of a WebKit start that
      // sits at `waiting` with no further event.
      layer.stallReloads++;
      layer.frameRequested = -1; // a reload drops any pending frame request
      const { video } = layer;
      const resumeAt = video.currentTime;
      video.addEventListener(
        "loadedmetadata",
        () => {
          if (layer.gen === gen && resumeAt > 0 && resumeAt < video.duration) {
            video.currentTime = resumeAt;
          }
        },
        { once: true },
      );
      video.load();
      this.play(layer);
    }, STALL_MS);
  }

  private clearStall(layer: Layer): void {
    window.clearTimeout(layer.stallTimer);
    layer.stallTimer = 0;
  }

  private retryOnGesture = () => {
    this.retryArmed = false;
    this.syncPlayback();
    this.evaluate();
  };

  /**
   * Pause a layer's film, and if it never presented a frame drop its source,
   * so an abandoned download stops competing with what is wanted now. A film
   * that has been on screen keeps its buffer for an instant return.
   */
  private release(layer: Layer): void {
    this.clearStall(layer);
    if (!layer.video.paused) this.pauseVideo(layer);
    const src = layer.video.getAttribute("src");
    if (src && src !== layer.presented) {
      layer.video.removeAttribute("src");
      layer.video.load();
    }
  }

  private clearLayerTimers(layer: Layer): void {
    window.clearTimeout(layer.stillTimer);
    window.clearTimeout(layer.lingerTimer);
    this.clearStall(layer);
  }

  /* ------------------------------------------------------------------ DOM */

  private setShow(layer: Layer, show: Show): void {
    layer.show = show;
    this.render(layer);
  }

  private render(layer: Layer): void {
    layer.root.dataset.show = layer.show;
  }

  private setRole(layer: BackdropLayer, role: Role): void {
    layer.root.dataset.role = role;
  }
}
