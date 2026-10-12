// The reveal: the Auralis orb rising out of the dark on a bed of light,
// the wordmark wiping on with a glint, the line underneath.
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Rays } from "./fx";
import { FONT } from "./pieces";
import { ease } from "./timing";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Logo: React.FC<{ dur: number; tagline?: string; small?: string; size?: number }> = ({
  dur,
  tagline = "Remember the future.",
  small,
  size = 1,
}) => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 46], [0, 1], { ...clamp, easing: Easing.bezier(...ease.out) });
  const word = interpolate(frame, [22, 58], [0, 1], { ...clamp, easing: Easing.bezier(...ease.out) });
  const glint = interpolate(frame, [40, 85], [-30, 130], clamp);
  const line = interpolate(frame, [62, 90], [0, 1], { ...clamp, easing: Easing.bezier(...ease.out) });
  const tiny = interpolate(frame, [84, 110], [0, 1], { ...clamp, easing: Easing.bezier(...ease.out) });
  const out = interpolate(frame, [dur - 18, dur], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: out }}>
      <Rays opacity={rise * 0.6} />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          opacity: rise,
          background: "radial-gradient(circle, rgba(170,230,255,0.55) 0%, rgba(60,160,255,0.18) 35%, rgba(0,80,200,0) 65%)",
          scale: 0.8 + rise * 0.3,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * size, scale: size }}>
        <Img
          src={staticFile("art/orb.png")}
          style={{
            width: 210,
            height: 210,
            opacity: rise,
            translate: `0px ${(1 - rise) * 60}px`,
            scale: 0.85 + rise * 0.15,
            rotate: `${(1 - rise) * -14}deg`,
            filter: `drop-shadow(0 18px 30px rgba(0,30,80,0.55)) drop-shadow(0 0 30px rgba(140,220,255,${0.6 * rise}))`,
          }}
        />
        <div
          style={{
            position: "relative",
            fontFamily: FONT,
            fontWeight: 300,
            fontSize: 168,
            lineHeight: 1,
            letterSpacing: `${0.12 - word * 0.08}em`,
            color: "#fff",
            opacity: word,
            filter: `blur(${(1 - word) * 16}px)`,
            textShadow: "0 4px 24px rgba(0,30,80,0.5), 0 0 60px rgba(120,210,255,0.6)",
            WebkitBoxReflect: "below -18px linear-gradient(transparent 55%, rgba(255,255,255,0.28))",
          }}
        >
          Auralis
          <span
            style={{
              position: "absolute",
              inset: 0,
              color: "transparent",
              backgroundImage: `linear-gradient(110deg, rgba(255,255,255,0) ${glint - 12}%, rgba(255,255,255,1) ${glint}%, rgba(255,255,255,0) ${glint + 12}%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              mixBlendMode: "screen",
            }}
          >
            Auralis
          </span>
        </div>
        <div
          style={{
            marginTop: 36,
            fontFamily: FONT,
            fontWeight: 300,
            fontSize: 46,
            letterSpacing: `${0.3 - line * 0.2}em`,
            color: "rgba(235,248,255,0.95)",
            opacity: line,
            filter: `blur(${(1 - line) * 8}px)`,
            textShadow: "0 2px 14px rgba(0,30,80,0.55)",
          }}
        >
          {tagline}
        </div>
        {small && (
          <div
            style={{
              marginTop: 8,
              fontFamily: FONT,
              fontWeight: 300,
              fontSize: 30,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(225,242,255,0.85)",
              opacity: tiny,
            }}
          >
            {small}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
