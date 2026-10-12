// The whole trailer is cut to the music: "White Space" runs at 144 BPM, so
// two bars are exactly 50 frames at 30 fps. Every scene starts on a bar.
export const FPS = 30;
export const BAR = 50;
export const bars = (n: number) => Math.round(n * BAR);

/** Where the music starts playing in the track (on a downbeat), in seconds.
 *  From here the track runs to its own ending in 76.7 s. */
export const MUSIC_OFFSET_S = 21.69;
export const DURATION = 2300;

export const T = {
  // Act I: memory
  droplet: 0,
  sunbeams: bars(3),
  bubbles: bars(6),
  fields: bars(9),
  // Act II: glass, then grey
  montage: bars(12),
  rain: bars(16),
  dusk: bars(19),
  dark: bars(22),
  // Act III: the reveal
  reveal: bars(23),
  product: bars(26),
  // Act IV: what it feels like
  flip: bars(31),
  sidebar: bars(33),
  welcome: bars(35),
  carousel: bars(37),
  // Act V: title
  title: bars(41),
} as const;

export const ease = {
  out: [0.16, 1, 0.3, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  soft: [0.33, 0, 0.2, 1] as const,
};
