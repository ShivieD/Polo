/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { shuffleArray as shuffle } from "./shuffle";

/*
 * OkLab color math for the Spectrum self-check, written inline (no deps).
 *
 * Spectrum needs hue steps that are perceptually equal, which HSL cannot
 * give — its hues bunch up around green and stretch through orange. OkLab
 * (via its cylindrical form OkLCh) spaces hues by how different they LOOK,
 * so equal rotations produce equally-distinguishable chips. That matters
 * because the whole test is "order these by hue": any two adjacent chips
 * should be exactly as hard to separate as any other pair.
 *
 * Test structure follows the Farnsworth panel tests: the first and last
 * chips of every row are FIXED anchors (like the D-15's reference cap),
 * and the player arranges only the chips between them. Level 2 splits the
 * wheel into four finer-stepped rows, in the spirit of the
 * Farnsworth-Munsell 100-hue test.
 */

/* OkLCh → sRGB. Björn Ottosson's reference constants. */
export function oklchToRgb(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  /* OkLab → LMS (cube roots undone) */
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  /* LMS → linear sRGB */
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  /* linear → gamma, clamped into gamut */
  const gamma = (x: number) => {
    const c = Math.max(0, Math.min(1, x));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  return [Math.round(gamma(R) * 255), Math.round(gamma(G) * 255), Math.round(gamma(B) * 255)];
}

/* ------------------------------------------------------------------ */
/* Rows, chips, and scoring                                            */
/* ------------------------------------------------------------------ */

/* Chips per row; the first and last are pinned anchors */
export const ROW_CHIPS = 15;

/* Level 1 sweeps 270° of the wheel between its anchors (~19° steps);
   Level 2's four rows each sweep 84° (~6° steps — three times finer). */
export const L1_SPAN = 270;
export const L2_SPAN = 84;

/* Fixed lightness and chroma chosen to stay inside the sRGB gamut across
   the full hue circle, so every chip differs by hue alone. */
const CHIP_L = 0.72;
const CHIP_C = 0.125;

export function hueColor(hue: number): string {
  const [r, g, b] = oklchToRgb(CHIP_L, CHIP_C, ((hue % 360) + 360) % 360);
  return `rgb(${r}, ${g}, ${b})`;
}

/* The hues of one row, evenly stepped from baseHue across span degrees */
export const rowHues = (baseHue: number, span: number, n = ROW_CHIPS): number[] =>
  Array.from({ length: n }, (_, i) => (baseHue + (i * span) / (n - 1)) % 360);

/* A row's order array: chip indices in display order. Anchors stay put;
   the middle is scrambled — never dealt already solved. */
export function dealRow(n = ROW_CHIPS): number[] {
  const middle = Array.from({ length: n - 2 }, (_, i) => i + 1);
  let scrambled: number[];
  do {
    scrambled = shuffle(middle);
  } while (scrambled.every((chip, i) => chip === middle[i]));
  return [0, ...scrambled, n - 1];
}

export interface RowScore {
  errTotal: number;
  maxErr: number;
  perChip: number[]; // positional error at each display position
}

/* With both ends anchored the expected order is simply ascending, so the
   error is each chip's distance from its own slot. maxErr is the fully
   reversed middle. */
export function scoreRow(order: number[]): RowScore {
  const n = order.length;
  const perChip = order.map((chip, p) => Math.abs(chip - p));
  const errTotal = perChip.reduce((a, b) => a + b, 0);
  let maxErr = 0;
  for (let p = 1; p < n - 1; p++) maxErr += Math.abs(n - 1 - p - p);
  return { errTotal, maxErr, perChip };
}

export type SpectrumRegion = "red-green" | "blue-yellow" | "general";

export interface SpectrumResult {
  score: number; // 0-100
  region: SpectrumRegion;
}

/* Combine one or more rows into a 0-100 score plus a region read: where do
   the misplaced chips live on the wheel? Confusions concentrated along the
   red→green arc suggest a red-green axis; along blue↔yellow, blue-yellow.
   Reported as a region only — never as a diagnosis. */
export function combineRows(rows: { hues: number[]; order: number[] }[]): SpectrumResult {
  let err = 0;
  let max = 0;
  let rg = 0;
  let by = 0;

  for (const row of rows) {
    const s = scoreRow(row.order);
    err += s.errTotal;
    max += s.maxErr;
    row.order.forEach((chip, p) => {
      const e = s.perChip[p];
      if (!e) return;
      const hue = ((row.hues[chip] % 360) + 360) % 360;
      if (hue < 180 || hue >= 330) rg += e;
      else by += e;
    });
  }

  const score = Math.round(100 * (1 - (max === 0 ? 0 : err / max)));
  const region: SpectrumRegion =
    rg + by === 0 ? "general" : rg >= 1.6 * by ? "red-green" : by >= 1.6 * rg ? "blue-yellow" : "general";

  return { score, region };
}
