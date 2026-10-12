// AURALIS: "Remember the future."
//
// I    Memory      water, light, a sky we used to have
// II   Glass       a rush of it… then the world goes grey
// III  Reveal      the Auralis orb rises out of the dark
// IV   Feeling     the browser, shown like a memory
// V    Title
import React from "react";
import { Audio } from "@remotion/media";
import { LightLeak } from "@remotion/light-leaks";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Bubbles, Flare, Grain, Letterbox, Rays, Vignette } from "./fx";
import { CineText, Footage, Frames, FONT, Screen, Shot } from "./pieces";
import { Logo } from "./Logo";
import { BAR, DURATION, ease, FPS, MUSIC_OFFSET_S, T } from "./timing";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const X = 12; // crossfade overlap

export const Trailer: React.FC = () => {
  const frame = useCurrentFrame();
  // Letterbox in for the memory, opening to full frame as the orb appears.
  const open = interpolate(frame, [T.reveal + 4, T.reveal + 40], [0, 1], { ...clamp, easing: Easing.bezier(...ease.inOut) });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* ---------------- I. Memory ---------------- */}
      <Shot name="Droplet" from={T.droplet} dur={T.sunbeams - T.droplet + X} fadeIn={40}>
        <Footage src="live/droplet.mp4" dur={T.sunbeams + X} rate={0.6} zoom={[1.12, 1.24]} />
        <Sequence from={40} layout="none">
          <CineText text="Do you remember" dur={T.sunbeams - 40} size={78} stagger={8} spacing={0.06} />
        </Sequence>
      </Shot>

      <Shot name="Sunbeams" from={T.sunbeams} dur={T.bubbles - T.sunbeams + X}>
        <Footage src="live/sunbeams.mp4" dur={T.bubbles - T.sunbeams + X} rate={0.8} zoom={[1.02, 1.16]} origin="50% 20%" />
        <Sequence from={14} layout="none">
          <CineText text="when the future looked like this?" dur={T.bubbles - T.sunbeams - 14} size={78} stagger={6} />
        </Sequence>
      </Shot>

      <Shot name="Bubbles" from={T.bubbles} dur={T.fields - T.bubbles + X}>
        <Footage src="live/bubbles.mp4" dur={T.fields - T.bubbles + X} rate={0.85} zoom={[1.0, 1.12]} />
        <Bubbles count={28} seed="act1" />
      </Shot>

      <Shot name="Fields" from={T.fields} dur={T.montage - T.fields + 2}>
        <Footage src="live/fields.mp4" start={6} dur={T.montage - T.fields} zoom={[1.0, 1.1]} origin="50% 70%" />
        <Sequence from={10} durationInFrames={BAR * 1.5} layout="none">
          <CineText text="Clear skies." dur={BAR * 1.5} size={96} spacing={0.04} />
        </Sequence>
        <Sequence from={10 + BAR * 1.5} layout="none">
          <CineText text="Green hills." dur={BAR * 1.5 - 10} size={96} spacing={0.04} />
        </Sequence>
      </Shot>

      {/* ---------------- II. Glass ---------------- */}
      <Montage from={T.montage} />

      <Shot name="Rain" from={T.rain} dur={T.dusk - T.rain + X} fadeIn={4}>
        <Footage src="live/rain.mp4" dur={T.dusk - T.rain + X} rate={0.7} zoom={[1.06, 1.14]} grade="saturate(0.85) contrast(1.05) brightness(0.95)" />
        <Sequence from={20} layout="none">
          <CineText text="Somewhere along the way," dur={T.dusk - T.rain - 20} size={78} stagger={7} glow="rgba(200,220,240,0.35)" />
        </Sequence>
      </Shot>

      <Shot name="Dusk, going grey" from={T.dusk} dur={T.dark - T.dusk} fadeOut={30}>
        <Greying from={0} to={T.dark - T.dusk}>
          <Footage src="live/dusk.mp4" start={4} dur={T.dark - T.dusk} rate={0.8} zoom={[1.0, 1.08]} />
        </Greying>
        <Sequence from={16} layout="none">
          <CineText text="the future turned grey." dur={T.dark - T.dusk - 16} size={78} stagger={7} glow="rgba(200,200,200,0.25)" />
        </Sequence>
      </Shot>

      {/* ---------------- III. Reveal ---------------- */}
      <Shot name="Reveal" from={T.reveal} dur={T.product - T.reveal + X} fadeIn={0}>
        <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 50% 45%, #0b3a78 0%, #04172f 55%, #010812 100%)" }} />
        <Sequence from={0} layout="none">
          <Bubbles count={24} seed="reveal" opacity={0.6} speed={0.6} />
        </Sequence>
        <Logo dur={T.product - T.reveal + X} />
      </Shot>
      <Flare at={T.reveal + 26} y={480} dur={46} />

      <Shot name="Live wallpapers" from={T.product} dur={T.flip - T.product + X}>
        <SkyBackdrop src="live/fields.mp4" dur={T.flip - T.product + X} />
        <Frames2 dur={T.flip - T.product} />
        <Sequence from={30} durationInFrames={BAR * 2.4} layout="none">
          <CineText text="A browser with the sky in it." dur={BAR * 2.4} size={64} align="bottom" />
        </Sequence>
        <Sequence from={30 + BAR * 2.6} layout="none">
          <CineText text="Real footage. Living wallpapers." dur={T.flip - T.product - 30 - BAR * 2.6} size={64} align="bottom" />
        </Sequence>
      </Shot>

      {/* ---------------- IV. Feeling ---------------- */}
      <Shot name="Flip 3D" from={T.flip} dur={T.sidebar - T.flip + X}>
        <SkyBackdrop src="live/bubbles.mp4" dur={T.sidebar - T.flip + X} />
        <Screen src="shots/flip3d-0.png" dur={T.sidebar - T.flip + X} from={{ ry: 12, rx: 5, s: 0.92, y: 20 }} to={{ ry: 4, rx: 2, s: 1, y: 0 }}>
          <Frames srcs={["shots/flip3d-0.png", "shots/flip3d-1.png", "shots/flip3d-2.png"]} every={BAR * 0.66} />
        </Screen>
        <Sequence from={14} layout="none">
          <CineText text="Flip through your world." dur={T.sidebar - T.flip - 14} size={64} align="bottom" />
        </Sequence>
      </Shot>

      <Shot name="Sidebar" from={T.sidebar} dur={T.welcome - T.sidebar + X}>
        <SkyBackdrop src="live/dolphins.mp4" dur={T.welcome - T.sidebar + X} />
        <PushInto src="shots/sidebar-wiki.png" dur={T.welcome - T.sidebar + X} origin="92% 45%" to={1.55} />
        <Sequence from={14} layout="none">
          <CineText text="Gadgets on the glass." dur={T.welcome - T.sidebar - 14} size={64} align="bottom" />
        </Sequence>
      </Shot>

      <Shot name="Two looks" from={T.welcome} dur={T.carousel - T.welcome + X}>
        <SkyBackdrop src="live/sunbeams.mp4" dur={T.carousel - T.welcome + X} />
        {/* the same window, Aqua turning into Modern on the beat */}
        <Screen src="shots/ntp-fields.png" dur={T.carousel - T.welcome + X} from={{ ry: -10, rx: 6, s: 0.9, y: 30 }} to={{ ry: 4, rx: 2, s: 0.97, y: 0 }}>
          <Frames srcs={["shots/ntp-fields.png", "shots/modern-ntp-fields.png"]} every={BAR} />
        </Screen>
        <Sequence from={10} layout="none">
          <CineText text="Aqua or Modern. You pick." dur={T.carousel - T.welcome - 10} size={64} align="bottom" stagger={5} />
        </Sequence>
      </Shot>

      <Shot name="Carousel" from={T.carousel} dur={T.title - T.carousel + X}>
        <SkyBackdrop src="live/borealis.mp4" dur={T.title - T.carousel + X} rate={0.6} />
        <Carousel dur={T.title - T.carousel + X} />
        <Sequence from={10} durationInFrames={BAR * 1.9} layout="none">
          <CineText text="Built for today." dur={BAR * 1.9} size={72} align="bottom" />
        </Sequence>
        <Sequence from={10 + BAR * 2} layout="none">
          <CineText text="Shaped like the future we were promised." dur={T.title - T.carousel - 10 - BAR * 2} size={64} align="bottom" stagger={4} />
        </Sequence>
      </Shot>

      {/* ---------------- V. Title ---------------- */}
      <Shot name="Title" from={T.title} dur={DURATION - T.title} fadeIn={20} fadeOut={40}>
        <Footage src="live/fields.mp4" start={18} dur={DURATION - T.title} zoom={[1.1, 1.0]} grade="saturate(1.25) contrast(1.04) brightness(1.06) blur(3px)" />
        <AbsoluteFill style={{ background: "radial-gradient(90% 80% at 50% 45%, rgba(0,40,100,0.15), rgba(0,20,60,0.55))" }} />
        <Bubbles count={30} seed="title" speed={0.7} />
        <Logo dur={DURATION - T.title + 30} small="A web browser for Windows" />
      </Shot>
      <Flare at={T.title + 30} y={520} dur={50} />

      {/* light leaks over the soft cuts */}
      <Leak at={T.bubbles} seed={3} />
      <Leak at={T.fields} seed={6} hue={160} />
      <Leak at={T.reveal + 20} seed={2} dur={50} />
      <Leak at={T.product} seed={9} />
      <Leak at={T.title} seed={4} dur={50} />

      {/* film */}
      <Vignette />
      <Letterbox open={open} />
      <Grain />
      <Soundtrack />
    </AbsoluteFill>
  );
};

/** Eight half-bar cuts of glassy, watery footage, one word each. */
const MONTAGE: [string, string, number][] = [
  ["live/koi.mp4", "Water.", 1],
  ["live/jellyfish.mp4", "Light.", 0.8],
  ["live/shoal.mp4", "Motion.", 1],
  ["live/waterfall.mp4", "Air.", 1],
  ["live/turbines.mp4", "Energy.", 0.5],
  ["live/borealis.mp4", "Wonder.", 0.7],
  ["live/dolphins.mp4", "Freedom.", 1],
  ["live/tank.mp4", "Glass.", 1],
];

const Montage: React.FC<{ from: number }> = ({ from }) => {
  const cut = BAR / 2;
  return (
    <>
      {MONTAGE.map(([src, word, rate], i) => (
        <Sequence key={src} from={from + i * cut} durationInFrames={cut} name={`Montage: ${word}`}>
          <Footage src={src} dur={cut} rate={rate} start={2} zoom={[1.18, 1.06]} grade="saturate(1.3) contrast(1.08) brightness(1.06)" />
          <Punch dur={cut} />
          <MontageWord word={word} dur={cut} />
        </Sequence>
      ))}
      {/* the white pop as the rush begins */}
      <Sequence from={from} durationInFrames={10} name="Flash">
        <WhiteFlash dur={10} />
      </Sequence>
    </>
  );
};

const MontageWord: React.FC<{ word: string; dur: number }> = ({ word, dur }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 8], [0, 1], { ...clamp, easing: Easing.bezier(...ease.out) });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 300,
          fontSize: 170,
          letterSpacing: `${0.2 - t * 0.12}em`,
          color: "#fff",
          opacity: interpolate(frame, [0, 5, dur - 4, dur], [0, 1, 1, 0.6], clamp),
          scale: 1.08 - t * 0.08,
          filter: `blur(${(1 - t) * 10}px)`,
          textShadow: "0 4px 30px rgba(0,30,80,0.55), 0 0 60px rgba(140,220,255,0.6)",
        }}
      >
        {word}
      </div>
    </AbsoluteFill>
  );
};

/** A quick exposure bloom on each cut. */
const Punch: React.FC<{ dur: number }> = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#dff4ff", opacity: interpolate(frame, [0, 4], [0.35, 0], clamp), mixBlendMode: "screen" }} />;
};

const WhiteFlash: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [0, dur], [0.9, 0], clamp) }} />;
};

/** Colour drains out of the picture over the shot: the "grey" years. */
const Greying: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const g = interpolate(frame, [from + 20, to - 10], [0, 1], { ...clamp, easing: Easing.bezier(...ease.inOut) });
  return <AbsoluteFill style={{ filter: `grayscale(${g}) brightness(${1 - g * 0.25}) contrast(${1 - g * 0.1})` }}>{children}</AbsoluteFill>;
};

/** Soft-focus sky footage behind the floating window. */
const SkyBackdrop: React.FC<{ src: string; dur: number; rate?: number }> = ({ src, dur, rate = 0.8 }) => (
  <>
    <Footage src={src} dur={dur} rate={rate} zoom={[1.12, 1.2]} grade="saturate(1.3) brightness(1.08) blur(14px)" />
    <AbsoluteFill style={{ background: "radial-gradient(80% 70% at 50% 40%, rgba(255,255,255,0.18), rgba(0,30,80,0.35))" }} />
    <Bubbles count={20} seed={src} opacity={0.7} speed={0.8} />
  </>
);

/** The new tab page, three live wallpapers in a row, the window drifting. */
const Frames2: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const shots = ["shots/ntp-fields.png", "shots/ntp-dolphins.png", "shots/ntp-bubbles.png"];
  const every = Math.round(dur / 3);
  return (
    <Screen src={shots[0]} dur={dur + X} from={{ ry: -14, rx: 6, s: 0.86, y: 40 }} to={{ ry: 6, rx: 3, s: 0.98, y: 0 }}>
      {shots.map((s, i) => (
        <AbsoluteFill key={s} style={{ opacity: i === 0 ? 1 : interpolate(frame, [i * every - 10, i * every + 6], [0, 1], clamp) }}>
          <Img src={staticFile(s)} style={{ width: "100%", height: "100%" }} />
        </AbsoluteFill>
      ))}
    </Screen>
  );
};

/** A slow push into one part of a screenshot. */
const PushInto: React.FC<{ src: string; dur: number; origin: string; to: number }> = ({ src, dur, origin, to }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: 1220,
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 40px 90px rgba(0,20,50,0.55), 0 0 0 1px rgba(255,255,255,0.35)",
          translate: "0px -95px",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            display: "block",
            width: "100%",
            transformOrigin: origin,
            scale: interpolate(frame, [0, dur], [1.02, to], { ...clamp, easing: Easing.bezier(...ease.inOut) }),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** Auralis' screens on a turning ring, like Vista's Flip 3D seen from outside. */
const RING = ["shots/ntp-fields.png", "shots/modern-sidebar-wiki.png", "shots/ntp-dolphins.png", "shots/appmenu.png", "shots/modern-ntp-fields.png", "shots/sidebar-wiki.png", "shots/welcome.png", "shots/modern-flip3d-2.png"];
const Carousel: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const turn = interpolate(frame, [0, dur], [-20, 70], { ...clamp, easing: Easing.bezier(...ease.soft) });
  const step = 360 / RING.length;
  return (
    <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: "50% 40%" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "44%",
          transformStyle: "preserve-3d",
          rotate: `0 1 0 ${-turn}deg`,
          translate: "0px 0px -1500px",
        }}
      >
        {RING.map((s, i) => (
          <div
            key={s}
            style={{
              position: "absolute",
              width: 760,
              marginLeft: -380,
              marginTop: -228,
              transform: `rotateY(${i * step}deg) translateZ(1200px)`,
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 30px 60px rgba(0,10,30,0.5), 0 0 0 1px rgba(255,255,255,0.4)",
              WebkitBoxReflect: "below 8px linear-gradient(transparent 70%, rgba(255,255,255,0.2))",
              backfaceVisibility: "hidden",
            }}
          >
            <Img src={staticFile(s)} style={{ display: "block", width: "100%" }} />
          </div>
        ))}
      </div>
      <Rays opacity={0.25} size={2400} />
    </AbsoluteFill>
  );
};

const Leak: React.FC<{ at: number; seed: number; hue?: number; dur?: number }> = ({ at, seed, hue = 190, dur = 40 }) => (
  <Sequence from={at - Math.round(dur / 2)} durationInFrames={dur} name={`Light leak ${at}`}>
    <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.75 }}>
      <LightLeak seed={seed} hueShift={hue} />
    </AbsoluteFill>
  </Sequence>
);

// ---- sound -------------------------------------------------------------------------

const Soundtrack: React.FC = () => {
  const f = (s: number) => Math.round(s * FPS);
  return (
    <>
      <Audio
        src={staticFile("music/white-space.mp3")}
        trimBefore={f(MUSIC_OFFSET_S)}
        volume={(fr) =>
          interpolate(
            fr,
            [0, 150, T.dusk + 60, T.dark, T.reveal + 2, T.reveal + 30, DURATION - 70, DURATION],
            [0, 0.55, 0.5, 0.1, 0.1, 0.85, 0.8, 0],
            clamp,
          )
        }
      />
      <Sfx src="sfx/bubbles.mp3" at={T.bubbles - 10} dur={T.fields - T.bubbles + 30} volume={0.22} fade />
      <Sfx src="sfx/swoosh.mp3" at={T.montage - 30} volume={0.45} />
      {MONTAGE.slice(1).map((_, i) => (
        <Sfx key={i} src="sfx/thin-swoosh.mp3" at={T.montage + (i + 1) * (BAR / 2) - 4} volume={0.16} />
      ))}
      <Sfx src="sfx/chime.mp3" at={T.reveal} volume={0.55} dur={f(6)} fade />
      <Sfx src="sfx/swoosh.mp3" at={T.product - 24} volume={0.3} />
      {[T.flip, T.sidebar, T.welcome, T.carousel].map((t) => (
        <Sfx key={t} src="sfx/thin-swoosh.mp3" at={t - 8} volume={0.22} />
      ))}
      <Sfx src="sfx/chime.mp3" at={T.title + 10} volume={0.35} dur={f(6)} fade />
    </>
  );
};

const Sfx: React.FC<{ src: string; at: number; volume: number; dur?: number; fade?: boolean }> = ({ src, at, volume, dur, fade }) => (
  <Sequence from={at} durationInFrames={dur} name={`SFX ${src}`} layout="none">
    <Audio
      src={staticFile(src)}
      volume={(fr) =>
        fade && dur ? interpolate(fr, [0, 12, dur - 30, dur], [0, volume, volume, 0], clamp) : volume
      }
    />
  </Sequence>
);
