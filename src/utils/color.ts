/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { shuffleArray } from "./shuffle";

export interface HSL {
  h: number; // 0 - 360
  s: number; // 0 - 100
  l: number; // 0 - 100
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255)
  ];
}

export function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  rNorm *= 100;
  gNorm *= 100;
  bNorm *= 100;

  const x = rNorm * 0.4124 + gNorm * 0.3576 + bNorm * 0.1805;
  const y = rNorm * 0.2126 + gNorm * 0.7152 + bNorm * 0.0722;
  const z = rNorm * 0.0193 + gNorm * 0.1192 + bNorm * 0.9505;

  return [x, y, z];
}

export function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;

  const xNorm = x / refX;
  const yNorm = y / refY;
  const zNorm = z / refZ;

  const f = (val: number) => {
    return val > 0.008856 ? Math.pow(val, 1 / 3) : (7.787 * val) + (16 / 116);
  };

  const fX = f(xNorm);
  const fY = f(yNorm);
  const fZ = f(zNorm);

  const L = (116 * fY) - 16;
  const a = 500 * (fX - fY);
  const b = 200 * (fY - fZ);

  return [L, a, b];
}

export function hslToLab(h: number, s: number, l: number): [number, number, number] {
  const [r, g, b] = hslToRgb(h, s, l);
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

export function computeDeltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

/* CIEDE2000 — unlike the plain Lab distance, this weights lightness, chroma
   and hue by how visible the difference actually is to the eye, so the same
   perceived gap scores the same regardless of which hue you're in. */
export function computeDeltaE2000(
  [L1, a1, b1]: [number, number, number],
  [L2, a2, b2]: [number, number, number]
): number {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = C1p === 0 ? 0 : (Math.atan2(b1, a1p) * deg + 360) % 360;
  const h2p = C2p === 0 ? 0 : (Math.atan2(b2, a2p) * deg + 360) % 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp: number;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else hbarp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * rad) +
    0.24 * Math.cos(2 * hbarp * rad) +
    0.32 * Math.cos((3 * hbarp + 6) * rad) -
    0.2 * Math.cos((4 * hbarp - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;

  return Math.sqrt(
    Math.pow(dLp / SL, 2) +
      Math.pow(dCp / SC, 2) +
      Math.pow(dHp / SH, 2) +
      RT * (dCp / SC) * (dHp / SH)
  );
}

/* Differences under one deltaE2000 unit are invisible to the eye — that's a
   perfect 100. Beyond that the score falls 2.5 points per unit of visible
   difference, hitting 0 around "unmistakably different". */
export function getScoreForColors(color1: HSL, color2: HSL): number {
  const lab1 = hslToLab(color1.h, color1.s, color1.l);
  const lab2 = hslToLab(color2.h, color2.s, color2.l);
  const deltaE = computeDeltaE2000(lab1, lab2);
  if (deltaE <= 1) return 100;
  return Math.round(Math.max(0, Math.min(100, 100 - 2.5 * (deltaE - 1))));
}

// Generate random aesthetic colors
export function generateRandomColor(): HSL {
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(Math.random() * 40) + 40; // 40 - 80%
  const l = Math.floor(Math.random() * 30) + 40; // 40 - 70%
  return { h, s, l };
}

// Generate an array of 5 near distractors + the correct color, shuffled.
/* `band` is the CIEDE2000-derived similarity window a distractor must land
   in: higher means more similar to the target, so a tighter, higher band is
   a harder board. Color Match walks this up once the tile count has topped
   out, so difficulty keeps climbing after the grid stops growing. */
export function generateSwatchOptions(
  correctColor: HSL,
  distractors = 5,
  band: [number, number] = [75, 96]
): { color: HSL; isCorrect: boolean }[] {
  const options: { color: HSL; isCorrect: boolean }[] = [{ color: correctColor, isCorrect: true }];

  // Distinct enough to be solvable, close enough to be near-distractors.
  for (let i = 0; i < distractors; i++) {
    let attempts = 0;
    let distractor: HSL = { h: 0, s: 0, l: 0 };
    let tooClose = true;
    
    while (tooClose && attempts < 10) {
      attempts++;
      // Apply subtle variation
      /* Offsets scale down as the required similarity climbs, so a tight
         band is reachable inside the retry budget instead of falling through
         to whatever the last attempt produced. */
      const tight = Math.max(0.35, Math.min(1, (100 - band[0]) / 25));
      const hOffset = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 16 + 8) * tight;
      const sOffset = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 12 + 6) * tight;
      const lOffset = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 10 + 5) * tight;
      
      distractor = {
        h: Math.round((correctColor.h + hOffset + 360) % 360),
        s: Math.round(Math.max(15, Math.min(95, correctColor.s + sOffset))),
        l: Math.round(Math.max(20, Math.min(85, correctColor.l + lOffset))),
      };
      
      // Compute score difference to make sure they are not exactly the same or too far
      // (band recalibrated for the CIEDE2000-based score)
      const score = getScoreForColors(correctColor, distractor);
      if (score >= band[0] && score <= band[1]) {
        tooClose = false;
      }
    }
    
    options.push({ color: distractor, isCorrect: false });
  }
  
  return shuffleArray(options);
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s2 = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h: Math.round(h), s: Math.round(s2 * 100), l: Math.round(l * 100) };
}

/* Perceived "paint mix" of N colors: the straight RGB average. Used by the
   Color Mixer's overlap levels so the scored value and the rendered lens
   are the same number. */
export function mixHslAverage(colors: HSL[]): HSL {
  let r = 0, g = 0, b = 0;
  for (const c of colors) {
    const [cr, cg, cb] = hslToRgb(c.h, c.s, c.l);
    r += cr; g += cg; b += cb;
  }
  const n = colors.length;
  return rgbToHsl(r / n, g / n, b / n);
}

export function hslToCss(color: HSL): string {
  return `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
}
