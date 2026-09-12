# Development placeholder media — NOT FLANK work

Everything in this folder is synthetic material generated locally with ffmpeg.
It is abstract moving greyscale gradient, nothing more.

**Every clip is engineered to be a true seamless loop.** Each frame is a sum of
sinusoids whose only time term is `T/D` (and `2*T/D`), so the image is exactly
periodic over the clip's own duration. Rendered at 24 fps for exactly `D*24`
frames, the last frame sits at phase `1 - 1/N`, which means the wrap from the
final frame back to frame 0 advances the phase by precisely one frame step —
the same step as every other frame in the clip. Position *and* velocity are
continuous across the seam; there is no fade, no black lead-in and no JS
restart hiding anything.

The first generation used ffmpeg's `gradients` source, which pans linearly and
never returns to its starting state. Its last frame did not match its first, so
every loop visibly jumped. That is why the expression-based approach replaced
it.

It is **not** FLANK work, not a client project, not stock footage, and not
licensed material from anywhere. It exists only so the Phase 4 preview system
can be built and reviewed — autoplay, hover start, looping, the poster → video
crossfade, `object-fit` and focal points, viewport-driven playback.

Deliberately varied in aspect ratio (16:9, 3:4, 21:9, 1:1, 12:5) so the
art-directed frames can be tested against media that does not match them, and
in duration (6, 7, 8, 9, 10, 11, 12 s — each one complete cycle) so the
autoplay previews drift apart instead of locking into step.

Encoded H.264 / yuv420p / CRF 28, no audio, one GOP per clip, `+faststart`.
A shorter GOP was measured and made the native loop boundary worse, so the
single-GOP encode is deliberate.

## What is in here

- `dev-preview-01..08.mp4` — the eight mosaic preview loops (03 has none; it is
  the `still` project).
- `dev-poster-*.jpg` — greyscale stills, one per project, extracted from frame 0
  of the matching clip. Frame 0 and not a later frame on purpose: the poster is
  then pixel-identical to the video's first frame, so the crossfade onto a
  freshly started loop has nothing to cross.
- `dev-about-loop.mp4` + `dev-about-poster.jpg` — the About page's right-hand
  brand visual. 10 s, 760x680, seamless by the same construction, slower and
  softer than the mosaic loops because it is a field rather than a preview.

There is a third asset class that is NOT in this folder: each project also
carries an inline ~24px `lqip` data URI in `src/data/projects.ts` (and
`src/data/about.ts`). Those are generated from the same frames and pasted into
the data, so they ship inside the HTML document — which is what makes a frame
impossible to catch empty, at any bandwidth, before hydration, with JavaScript
off. Regenerate them alongside the posters if the clips change.

## Also serving as full films (Phase 5)

Each project's `fullVideo` currently points at the SAME clip as its
`previewVideo`. That is a **development fallback** so the project viewer can be
built and reviewed; these are not FLANK films, not stock, and not anybody's
work. They are 512-960px wide and 6-12 s long, so they look soft blown up to a
full viewer — which is a property of the placeholder, not of the player.

Nothing in the viewer depends on any of it. A real cut may be 15 s or 90 s,
portrait, landscape or square, silent or with sound, and unrelated to the
preview loop; the viewer never loops a full film, reads its true dimensions
from the media itself, and requests only the one project that is open.

Project 03 deliberately has no `fullVideo` at all — it is the photography
piece, and it exists so the viewer stays correct for work that is not a film.

Delete this folder when the real media arrives; the only references are
`media` entries in `src/data/projects.ts` and `aboutVisualVideo` in
`src/data/about.ts`.

Regenerate: see the `gen()` helper recorded in the Phase 4.1 report. If you
replace these by hand, keep the seamless-loop property — the homepage relies on
`loop` cycling with no visible seam and does nothing to conceal one.
