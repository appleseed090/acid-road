/** Linear RGB triple with components nominally in [0, 1]; lit or emissive colours may exceed 1. */
export type Rgb = readonly [number, number, number];

export function hslToRgb(hueDegrees: number, saturation: number, lightness: number): Rgb {
  const h = ((hueDegrees % 360) + 360) % 360 / 60;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(h % 2 - 1));
  const m = lightness - chroma / 2;
  const [r, g, b]: Rgb =
    h < 1 ? [chroma, x, 0] : h < 2 ? [x, chroma, 0] : h < 3 ? [0, chroma, x] : h < 4 ? [0, x, chroma] : h < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return [r + m, g + m, b + m];
}

export function scaled(color: Rgb, factor: number): Rgb {
  return [color[0] * factor, color[1] * factor, color[2] * factor];
}

export function mixed(from: Rgb, to: Rgb, t: number): Rgb {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
}
