# Intro V2 — dedicated wordmark clips

Purpose-cut derivatives for the FLANK wordmark intro ONLY. Nothing else on the
site loads them, and nothing here is a source of truth: every one is a lossless
recipe away from the Phase 7 master it came from, recorded below, so they can be
regenerated or re-graded without hunting for the moment again.

The FLANK mark is 6.63:1. Homepage previews are cut for a 16:9 card, so inside
the mask they deliver a horizontal sliver of a composition art-directed for a
completely different shape. These three are framed for the letterforms instead.
OTP and Bohinj use a 5:1 source crop, leaving the browser a little vertical
headroom. Pingo deliberately takes a deeper 3.84:1 source band into the same
5:1 derivative: through the shallow mask this keeps helmet, eyes and beak in
one readable beat instead of magnifying one feature.

Masters are never modified. Regenerate with:

    ffmpeg -ss <IN> -t <DUR> -i <SOURCE> \
      -vf "crop=<CROP>,scale=960:192:flags=lanczos" \
      -an -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 18 \
      -preset veryslow -g 48 -movflags +faststart <OUT>

| file              | source                                | in     | dur   | crop (w:h:x:y)      |
|-------------------|---------------------------------------|--------|-------|---------------------|
| intro-pingo.mp4   | _incoming-media/Pingo_Scenarij2_15s_16-9_27052026_Final.mp4 | 1.28s | 0.56s | 1920:500:0:190 |
| intro-otp.mp4     | _incoming-media/OTP_Image_TVC_sep2026_25s_YT.mov | 1.28s | 0.56s | 1400:280:520:500 |
| intro-bohinj.mp4  | media/projects/bohinj/full.mp4        | 8.60s  | 1.38s | 1920:384:0:432      |

Every window sits inside ONE source shot — verified against the masters' own
scene-cut lists (bohinj cuts at 1.63/2.75/7.33/8.42/10.04/11.33/12.29s; pingo-2
at 2.64/8.48/9.92/12.20s; otp at 2.80/5.96/7.80/9.68…s) — so no clip carries an
accidental second edit inside it.

All three: 960x192, no audio or timecode track, faststart. ~348KiB total.

Representative QA frames live in `qa/`: each subject has its 1.56s source
frame, the exact 42vw desktop and 390px mobile rectangular crop, and an SVG
preview using the official FLANK geometry on black.
