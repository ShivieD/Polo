/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export function getScoreForColors(color1: HSL, color2: HSL): number {
  const lab1 = hslToLab(color1.h, color1.s, color1.l);
  const lab2 = hslToLab(color2.h, color2.s, color2.l);
  const deltaE = computeDeltaE(lab1, lab2);
  return Math.round(Math.max(0, 100 - deltaE * 2.0));
}

// Generate random aesthetic colors
export function generateRandomColor(): HSL {
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(Math.random() * 40) + 40; // 40 - 80%
  const l = Math.floor(Math.random() * 30) + 40; // 40 - 70%
  return { h, s, l };
}

// Generate an array of 5 near distractors + the correct color, shuffled.
export function generateSwatchOptions(correctColor: HSL): { color: HSL; isCorrect: boolean }[] {
  const options: { color: HSL; isCorrect: boolean }[] = [{ color: correctColor, isCorrect: true }];
  
  // Try to make them distinct enough to be solvable, but close enough to be near-distractors.
  // We'll generate 5 different distractors.
  for (let i = 0; i < 5; i++) {
    let attempts = 0;
    let distractor: HSL = { h: 0, s: 0, l: 0 };
    let tooClose = true;
    
    while (tooClose && attempts < 10) {
      attempts++;
      // Apply subtle variation
      const hOffset = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 16) + 8); // 8 to 24 deg
      const sOffset = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 12) + 6); // 6 to 18 %
      const lOffset = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 10) + 5); // 5 to 15 %
      
      distractor = {
        h: (correctColor.h + hOffset + 360) % 360,
        s: Math.max(15, Math.min(95, correctColor.s + sOffset)),
        l: Math.max(20, Math.min(85, correctColor.l + lOffset)),
      };
      
      // Compute score difference to make sure they are not exactly the same or too far
      const score = getScoreForColors(correctColor, distractor);
      if (score >= 70 && score <= 92) {
        tooClose = false;
      }
    }
    
    options.push({ color: distractor, isCorrect: false });
  }
  
  // Shuffle options
  return options.sort(() => Math.random() - 0.5);
}

export function hslToCss(color: HSL): string {
  return `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
}
