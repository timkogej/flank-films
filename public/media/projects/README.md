# Phase 7 media manifest

Archive masters remain in `/_incoming-media` and are intentionally ignored by
Git. The files in this directory are browser derivatives only. Nothing here is
ever produced by mutating a master: every entry below is a read of a master and
a write of a new file.

All previews are silent H.264 MP4, `yuv420p`, fast-start, at source frame rate.
All full films are H.264/AAC MP4, `yuv420p`, fast-start, uncropped and at source
frame rate. Poster and still files are high-quality JPEG because this local
ffmpeg build has no WebP or AVIF encoder — checked again on 2026-09-10, and
`sips` cannot write either format either.

## Active homepage mapping (eight slots)

| Slot | Project / slug | Source master | Poster | Preview segment and loop | Mode | Preview | Full film |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | Fructal — Pingo Vitamin Water / `pingo-2` | `Pingo_Scenarij2_15s_16-9_27052026_Final.mp4` | 4.50s, 1920×1080, 0.16 MB | 0.40–10.00s; natural seasonal/graphic editorial cut | autoplay | 1280×720, 9.60s, 3.74 MB | 1920×1080, 15.02s, 13.62 MB |
| 02 | Fresh 32 — Feel the freshness / `fresh32` | `Fresh32.mp4` | 5.80s, 1920×1080, 0.15 MB | 3.20–12.20s; cyclic 0.40s macro-particle overlap | hover | 1280×720, 8.60s, 2.85 MB | 1920×1080, 18.37s, 11.61 MB |
| 03 | Petrol — OOH Billboard / `petrol` | `PETROL_Kava na putu_mockup.png` | 1600×1074, 0.26 MB | — (still project, no video) | still | — | still 2560×1718, 0.65 MB |
| 04 | Schweppes — Take your time / `schweppes` | `Schweps ad_169.mp4` | 5.167s, 1920×1080, 0.13 MB | 5.167–11.900s; source cut to source cut | hover | 1280×720, 6.73s, 1.93 MB | 1920×1080, 15.07s, 12.41 MB |
| 05 | Bohinj — Push the limit (spec) / `bohinj-vertical` | `Push the limits_Bohinj_Ad_9_16.mp4` | 9.20s, 1080×1920, 0.15 MB | 7.00–13.75s; natural motion/edit cut before the logo | autoplay | 720×1280, 6.75s, 3.76 MB | 1080×1920, 15.07s, 21.74 MB |
| 06 | Fructal — Pingo Vitamin Water / `pingo-1` | `Pingo_Scenarij1_15s_16-9_27052026_Final.mp4` | 4.00s, 1920×1080, 0.11 MB | 5.28–11.20s; matched water/splash motion cut | autoplay | 1280×720, 5.92s, 6.45 MB | 1920×1080, 15.02s, 22.95 MB |
| 07 | Fructal — Pingo Vitamin Water / `pingo-3` | `Pingo_Scenarij3_10s_16-9_27052026_Final.mp4` | 3.60s, 1920×1080, 0.33 MB | 0.40–6.56s; natural gesture/edit cut before packshot | hover | 1280×720, 6.16s, 2.91 MB | 1920×1080, 10.01s, 9.89 MB |
| 08 | OTP Banka — Pogumno je iti na zmago / `otp` | `OTP_Image_TVC_sep2026_25s_YT.mov` | 1.20s, 1920×1080, 0.53 MB | 5.00–12.00s; natural cut on the existing edit | autoplay | 1280×720, 7.00s, 2.69 MB | 1920×1080, 25.00s, 60.00 MB |

Active derivative weight is approximately **179.0 MB**: 2.48 MB posters and
stills, 24.33 MB homepage previews and 152.22 MB full films. What the homepage
itself can fetch is the first two of those — about 26.8 MB, and the previews
only as each card is actually wanted. Full films are
requested only for the currently open viewer project; the homepage never
downloads them, which was re-verified from the network log on 2026-09-10 —
eight posters, seven previews, zero full films.

OTP is the largest derivative at 60.00 MB. It is deliberately conservative: the
385.11 MB ProRes 422 source was converted at 25 fps with explicit Rec.709
colour tags rather than aggressively compressing skin, gradients and graphics.

## Schweppes — new for this pass (2026-09-10)

Source master `Schweps ad_169.mp4` (the incoming filename; left untouched).
The public brand spelling is **Schweppes**, read off the bottle label in the
supplied creative, not off the filename. The campaign line **Take your time**
is the end card's own copy (13.0–15.07s).

- Source: 1920×1080, 30 fps, H.264 Main, 27.52 Mb/s, AAC-LC 44.1 kHz stereo,
  15.069s, 52.21 MB.
- Source cuts: 5.167s, 5.933s, 6.633s, 11.900s, 12.067s.
- Poster: frame at **5.167s** — the first frame of the bottle hero and the
  first frame of the preview, so the poster→loop crossfade has nothing to
  cross. 1920×1080, 140.6 KB.
- Preview: **5.167s → 11.900s** (6.733s), 1280×720, CRF 18, silent, 1.93 MB (2.29 Mb/s).
  The window is one source cut to the next: bottle hero → bubble macro →
  performance beat. It ends before the packshot and the end card, and because
  both ends are the film's own cut points the loop reads as one more edit
  rather than as a wrap-around. No overlap or dissolve was added.
- Full film: whole 15.07s uncropped, 1920×1080 at 30 fps, CRF 16 (6.59 Mb/s),
  AAC 192 kb/s 48 kHz, faststart, 12.41 MB. SSIM against the source is 0.9929
  (Y 0.9918); CRF 18 measured 0.9921 for 9.16 MB and CRF 16 was chosen for
  headroom on the gradients and bokeh.
- Focal point: `50% 45%` desktop and mobile. Checked across the whole loop in
  the 591×274 frame and the 21:9 mobile band.

## Petrol — new for this pass (2026-09-10)

Source master `PETROL_Kava na putu_mockup.png`, 10112×6784 (1.4906:1), 96.38 MB.
The master is never served: it is roughly 100× the weight of the derivative the
card uses.

- Poster (homepage card): 1600×1074, JPEG q3, 256 KB. Covers 2× on every
  breakpoint — the largest Petrol frame is the 333×376 tablet card, which needs
  1124 px of image height at 2×.
- Still (viewer): 2560×1718, JPEG q2, 653 KB. Loaded only by the open viewer.
- LQIP: 24×16 inline JPEG, 349 bytes, ICC profile stripped.
- Focal point: `45% 50%` desktop, `43% 50%` mobile. The 3:2 artwork is cropped
  hard by a portrait card; left of centre is what keeps the whole PETROL canopy
  sign, the model and the cup inside the frame at every breakpoint.

## Not in the active mapping

Moje Leče is not part of the homepage. Its master remains untouched in
`/_incoming-media` for possible later use.

The 16:9 Bohinj (`Push the limits_Bohinj_spec_Ad.mp4`, `bohinj`) is no longer an
active project: it was the same spec as the portrait film and read as a
duplicate. Its master is untouched and its derivatives are kept here, archived
and unreferenced, at 1920×1080 poster 429.7 KB / preview 0.20–8.50s with a
cyclic 0.30s overlap, 8.00s, 5.98 MB / full 15.07s, 21.18 MB (27.6 MB in all). The preview and
full film were regenerated from the master on 2026-09-10 to the recipe recorded
above after being deleted in error; the poster is byte-identical to the
original. `/work/bohinj` now permanently redirects to `/work/bohinj-vertical`.
