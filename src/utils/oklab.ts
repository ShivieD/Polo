/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * OkLab color math for the Spectrum self-check, written inline (no deps).
 *
 * Spectrum needs hue steps that are perceptually equal, which HSL cannot
 * give — its hues bunch up around green and stretch through orange. OkLab
 * (via its cylindrical form OkLCh) spaces hues by how different they LOOK,
 * so 15 equal rotations produce 15 equally-distinguishable chips. That
 * matters because the whole test is "order these by hue": any two adjacent
 * chips should be exactly as hard to separate as any other pair.
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
/* Spectrum chips and scoring                                          */
/* ------------------------------------------------------------------ */

export const CHIP_COUNT = 15;

/* Fixed lightness and chroma chosen to stay inside the sRGB gamut across
   the full hue circle, so every chip differs by hue alone. */
const CHIP_L = 0.72;
const CHIP_C = 0.125;

export const chipHue = (chip: number) => chip * (360 / CHIP_COUNT);

export function chipColor(chip: number): string {
  const [r, g, b] = oklchToRgb(CHIP_L, CHIP_C, chipHue(chip));
  return `rgb(${r}, ${g}, ${b})`;
}

/* Distance between two chips around the hue circle (0..7 for 15 chips) */
const circDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % CHIP_COUNT;
  return Math.min(d, CHIP_COUNT - d);
};

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

export interface SpectrumResult {
  score: number; // 0-100
  region: "red-green" | "blue-yellow" | "general";
  /* The true hue order rotated/reflected to best match the user's row, so
     the result screen can show the two rows column-aligned */
  reference: number[];
  errorTotal: number;
}

/* A scrambled starting row — never dealt already solved */
export function dealChips(): number[] {
  let chips: number[];
  do {
    chips = shuffle(Array.from({ length: CHIP_COUNT }, (_, i) => i));
  } while (scoreArrangement(chips).score >= 100);
  return chips;
}

/* Sum of cyclic position errors between the arrangement and the true hue
   order. The wheel has no fixed start and no fixed direction, so every
   rotation and both directions are tried; the best alignment is the one
   the player earns. */
export function scoreArrangement(arr: number[]): SpectrumResult {
  let best = Infinity;
  let bestPerChip: number[] = [];
  let bestRef: number[] = [];

  for (const dir of [1, -1]) {
    for (let r = 0; r < CHIP_COUNT; r++) {
      const expected = arr.map((_, p) => (((r + dir * p) % CHIP_COUNT) + CHIP_COUNT) % CHIP_COUNT);
      const perChip = arr.map((chip, p) => circDist(chip, expected[p]));
      const total = perChip.reduce((a, b) => a + b, 0);
      if (total < best) {
        best = total;
        bestPerChip = perChip;
        bestRef = expected;
      }
    }
  }

  /* Normalize against every chip being maximally displaced */
  const maxErr = Math.floor(CHIP_COUNT / 2) * CHIP_COUNT;
  const score = Math.round(100 * (1 - best / maxErr));

  /* Where do the errors live? Confusions concentrated along the red→green
     arc suggest a red-green axis; along the blue↔yellow arc, blue-yellow.
     Reported as a region only — never as a diagnosis. */
  let rg = 0;
  let by = 0;
  arr.forEach((chip, p) => {
    const e = bestPerChip[p];
    if (!e) return;
    const hue = chipHue(chip);
    if (hue < 180 || hue >= 330) rg += e;
    else by += e;
  });
  const region: SpectrumResult["region"] =
    rg + by === 0 ? "general" : rg >= 1.6 * by ? "red-green" : by >= 1.6 * rg ? "blue-yellow" : "general";

  return { score, region, reference: bestRef, errorTotal: best };
}
