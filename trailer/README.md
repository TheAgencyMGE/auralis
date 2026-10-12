# Auralis trailer

A 77-second cinematic trailer, made with Remotion (1920×1080, 30 fps).
It's cut to the music: two bars of the 144 BPM track are exactly 50 frames.

    npm i
    npx remotion studio                      # preview and scrub
    npx remotion render AuralisTrailer out/auralis-trailer.mp4 --crf=16

Fresh screenshots of Auralis: from the Auralis repo root, run `npm run build`,
then `node trailer/scripts/capture.mjs`.

The timeline lives in src/trailer/Trailer.tsx; scene start frames are in
src/trailer/timing.ts. See CREDITS.md for every asset.

The footage, music and sound effects aren't in the repository, because their
licenses cover the finished video but not handing out the files themselves.
CREDITS.md links every one of them. Download each into public/live, public/music
or public/sfx under the file name Trailer.tsx uses, then run capture.mjs for
public/shots.

scripts/site-media.mjs makes the website's banner, social card, poster and
animated teaser from a render.
