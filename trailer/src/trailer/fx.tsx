// Film treatment shared by every scene: grain, vignette, letterbox, an
// anamorphic flare, and glass bubbles drifting up through the frame.
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ease } from "./timing";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Moving film grain: fractal noise re-seeded every frame. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity, pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 12} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(120% 95% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,12,30,${strength}) 100%)`,
    }}
  />
);

/** 2.39:1 bars that can open to full frame. `open` 0 = bars in, 1 = gone. */
export const Letterbox: React.FC<{ open: number }> = ({ open }) => {
  const { height, width } = useVideoConfig();
  const bar = ((height - width / 2.39) / 2) * (1 - open);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bar, background: "#000" }} />
    </AbsoluteFill>
  );
};

/** A horizontal anamorphic streak, the kind a lens throws across a bright light. */
export const Flare: React.FC<{ at: number; y?: number; dur?: number; color?: string }> = ({
  at,
  y = 540,
  dur = 40,
  color = "160,220,255",
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at, at + dur * 0.35, at + dur], [0, 1, 0], {
    ...clamp,
    easing: Easing.bezier(...ease.soft),
  });
  if (t <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: y,
          width: 2400,
          height: 6,
          marginLeft: -1200,
          marginTop: -3,
          scale: `${0.3 + t * 0.9} 1`,
          opacity: t,
          background: `linear-gradient(90deg, rgba(${color},0) 0%, rgba(${color},0.55) 35%, rgba(255,255,255,1) 50%, rgba(${color},0.55) 65%, rgba(${color},0) 100%)`,
          filter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: y,
          width: 900,
          height: 900,
          marginLeft: -450,
          marginTop: -450,
          opacity: t * 0.7,
          background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(${color},0.35) 18%, rgba(${color},0) 60%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Glass bubbles rising with a slow sway; the big near ones are out of focus. */
export const Bubbles: React.FC<{ count?: number; seed?: string; opacity?: number; speed?: number }> = ({
  count = 36,
  seed = "b",
  opacity = 1,
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const size = 14 + Math.pow(r("s"), 2.2) * 150;
        const near = size > 90;
        const rise = (0.6 + r("v") * 1.4) * speed * (0.7 + size / 160);
        const span = height + 300;
        const y = height + 150 - ((frame * rise + r("o") * span) % span);
        const x = r("x") * width + Math.sin((frame + r("p") * 300) / (40 + r("w") * 40)) * (12 + size * 0.15);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0 5%, rgba(255,255,255,0.18) 16%, rgba(190,235,255,0.06) 50%, rgba(255,255,255,0.35) 68%, rgba(255,255,255,0.75) 71%, rgba(255,255,255,0) 73%)",
              filter: near ? `blur(${(size - 90) / 14}px)` : undefined,
              opacity: near ? 0.55 : 0.85,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Soft god rays turning slowly behind something bright. */
export const Rays: React.FC<{ opacity: number; size?: number }> = ({ opacity, size = 1800 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        opacity,
        rotate: `${frame * 0.08}deg`,
        background:
          "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.09) 0deg 2.5deg, rgba(255,255,255,0) 2.5deg 11deg, rgba(255,255,255,0.05) 11deg 12deg, rgba(255,255,255,0) 12deg 19deg)",
        maskImage: "radial-gradient(circle, #000 0%, rgba(0,0,0,0.6) 25%, transparent 60%)",
        WebkitMaskImage: "radial-gradient(circle, #000 0%, rgba(0,0,0,0.6) 25%, transparent 60%)",
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
};
