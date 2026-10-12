// Building blocks: a fading shot, real footage with a slow push, cinematic
// type, and Auralis' window floating in 3D over the sky.
import React from "react";
import { Video } from "@remotion/media";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { ease } from "./timing";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const FONT = "'Segoe UI Light', 'Segoe UI', 'Segoe UI Variable Display', system-ui, sans-serif";
export const FONT_REG = "'Segoe UI', 'Segoe UI Variable Text', system-ui, sans-serif";

/** A scene on the timeline that fades in and out over its neighbours. */
export const Shot: React.FC<{
  from: number;
  dur: number;
  name: string;
  fadeIn?: number;
  fadeOut?: number;
  children: React.ReactNode;
}> = ({ from, dur, name, fadeIn = 12, fadeOut = 12, children }) => (
  <Sequence from={from} durationInFrames={dur} name={name}>
    <Fade dur={dur} fadeIn={fadeIn} fadeOut={fadeOut}>
      {children}
    </Fade>
  </Sequence>
);

const Fade: React.FC<{ dur: number; fadeIn: number; fadeOut: number; children: React.ReactNode }> = ({
  dur,
  fadeIn,
  fadeOut,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    fadeIn ? interpolate(frame, [0, fadeIn], [0, 1], clamp) : 1,
    fadeOut ? interpolate(frame, [dur - fadeOut, dur], [1, 0], clamp) : 1,
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/** Real footage, graded warm-cyan like an old Vista wallpaper, with a slow push-in. */
export const Footage: React.FC<{
  src: string;
  dur: number;
  rate?: number;
  start?: number;
  zoom?: [number, number];
  origin?: string;
  grade?: string;
}> = ({ src, dur, rate = 1, start = 0, zoom = [1.04, 1.14], origin = "50% 50%", grade }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#02101f" }}>
      <AbsoluteFill
        style={{
          scale: interpolate(frame, [0, dur], zoom, { ...clamp, easing: Easing.bezier(...ease.soft) }),
          transformOrigin: origin,
          filter: grade ?? "saturate(1.18) contrast(1.06) brightness(1.04)",
        }}
      >
        <Video
          src={staticFile(src)}
          muted
          loop
          playbackRate={rate}
          trimBefore={Math.round(start * 30)}
          objectFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Words that drift in out of focus and settle, then dissolve. Each word
 * arrives a beat after the last.
 */
export const CineText: React.FC<{
  text: string;
  dur: number;
  size?: number;
  delay?: number;
  stagger?: number;
  spacing?: number;
  weight?: number;
  y?: number;
  glow?: string;
  align?: "center" | "bottom";
}> = ({ text, dur, size = 84, delay = 0, stagger = 5, spacing = 0.02, weight = 300, y = 0, glow = "rgba(120,200,255,0.55)", align = "center" }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const out = interpolate(frame, [dur - 16, dur], [1, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        justifyContent: align === "bottom" ? "flex-end" : "center",
        alignItems: "center",
        paddingBottom: align === "bottom" ? 64 : 0,
      }}
    >
      {/* a soft bloom of shade behind the words, so they read over anything */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: align === "bottom" ? undefined : "50%",
          bottom: align === "bottom" ? 10 : undefined,
          width: Math.min(1700, text.length * size * 0.62 + 300),
          height: size * 3.2,
          translate: align === "bottom" ? "-50% 0" : `-50% calc(-50% + ${y}px)`,
          background: "radial-gradient(closest-side, rgba(0,18,45,0.55), rgba(0,18,45,0))",
          opacity: out * interpolate(frame, [delay, delay + 20], [0, 1], clamp),
        }}
      />
      <div
        style={{
          translate: `0px ${y}px`,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `0 ${size * 0.28}px`,
          maxWidth: 1500,
          fontFamily: FONT,
          fontWeight: weight,
          fontSize: size,
          lineHeight: 1.15,
          letterSpacing: `${spacing}em`,
          color: "#fff",
          textAlign: "center",
          textShadow: `0 2px 18px rgba(0,25,60,0.55), 0 0 40px ${glow}`,
          opacity: out,
          filter: `blur(${interpolate(frame, [dur - 16, dur], [0, 10], clamp)}px)`,
        }}
      >
        {words.map((w, i) => {
          const t0 = delay + i * stagger;
          const t = interpolate(frame, [t0, t0 + 26], [0, 1], { ...clamp, easing: Easing.bezier(...ease.out) });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: t,
                filter: `blur(${(1 - t) * 14}px)`,
                translate: `0px ${(1 - t) * 18}px`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Auralis' window, floating in perspective with a wet-floor reflection. */
export const Screen: React.FC<{
  src: string;
  dur: number;
  width?: number;
  from?: { ry: number; rx: number; s: number; y: number };
  to?: { ry: number; rx: number; s: number; y: number };
  glare?: boolean;
  children?: React.ReactNode;
}> = ({
  src,
  dur,
  width = 1180,
  from = { ry: -16, rx: 7, s: 0.9, y: 30 },
  to = { ry: -5, rx: 3, s: 1, y: 0 },
  glare = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [0, dur], [0, 1], { ...clamp, easing: Easing.bezier(...ease.soft) });
  const lerp = (a: number, b: number) => a + (b - a) * k;
  const sweep = interpolate(frame, [dur * 0.25, dur * 0.75], [-60, 160], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", perspective: 2200 }}>
      <div
        style={{
          position: "relative",
          width,
          rotate: `0 1 0 ${lerp(from.ry, to.ry)}deg`,
          scale: lerp(from.s, to.s),
          translate: `0px ${lerp(from.y, to.y) - 95}px`,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            rotate: `1 0 0 ${lerp(from.rx, to.rx)}deg`,
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 40px 90px rgba(0,20,50,0.55), 0 0 0 1px rgba(255,255,255,0.35)",
            WebkitBoxReflect: "below 10px linear-gradient(transparent 72%, rgba(255,255,255,0.22))",
            position: "relative",
          }}
        >
          <div style={{ position: "relative", width: "100%", aspectRatio: "1600 / 960" }}>
            {children ?? <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />}
          </div>
          {glare && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(115deg, rgba(255,255,255,0) ${sweep - 20}%, rgba(255,255,255,0.28) ${sweep}%, rgba(255,255,255,0) ${sweep + 14}%)`,
                mixBlendMode: "screen",
              }}
            />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Several captured frames played as one moving shot (Flip 3D flipping). */
export const Frames: React.FC<{ srcs: string[]; every: number }> = ({ srcs, every }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {srcs.map((s, i) => {
        const o = i === 0 ? 1 : interpolate(frame, [i * every - 6, i * every + 4], [0, 1], clamp);
        return (
          <AbsoluteFill key={s} style={{ opacity: o }}>
            <Img src={staticFile(s)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
