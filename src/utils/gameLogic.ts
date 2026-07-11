/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HSL, generateRandomColor, generateSwatchOptions } from "./color";
import {
  SwatchRoundData,
  MixRoundData,
  EchoRoundData,
  BetweenRoundData,
  ShiftRoundData,
  TallyRoundData,
} from "../types";

export function setupSwatchRound(): SwatchRoundData {
  const targetColor = generateRandomColor();
  const options = generateSwatchOptions(targetColor);
  return {
    targetColor,
    options,
    userSelection: null,
  };
}

export function setupMixRound(): MixRoundData {
  const targetColor = generateRandomColor();
  // Generate a starting user color that is quite different
  // Hue is shifted by 120 - 240 degrees (so it's clearly distinct)
  const hOffset = 120 + Math.floor(Math.random() * 120);
  const sOffset = (Math.random() > 0.5 ? 1 : -1) * (20 + Math.floor(Math.random() * 15));
  const lOffset = (Math.random() > 0.5 ? 1 : -1) * (15 + Math.floor(Math.random() * 15));

  const userColor = {
    h: (targetColor.h + hOffset) % 360,
    s: Math.max(15, Math.min(95, targetColor.s + sOffset)),
    l: Math.max(20, Math.min(85, targetColor.l + lOffset)),
  };

  return {
    targetColor,
    userColor,
    score: null,
  };
}

export function setupEchoRound(): EchoRoundData {
  // 4 distinct cohesive colors
  const baseHue = Math.floor(Math.random() * 360);
  const squares = [0, 1, 2, 3].map((id) => {
    // Spaced out hues (e.g. analogous or complementary color scheme)
    const h = (baseHue + id * 45) % 360;
    const s = 65 + Math.floor(Math.random() * 15);
    const l = 45 + Math.floor(Math.random() * 15);
    return { id, color: { h, s, l } };
  });

  // Random permutation of 0, 1, 2, 3
  const sequence = [0, 1, 2, 3].sort(() => Math.random() - 0.5);

  return {
    squares,
    sequence,
    userTaps: [],
    isCorrect: null,
  };
}

export function setupBetweenRound(): BetweenRoundData {
  const colorStart = generateRandomColor();
  
  // Make end color contrasting / distinct hue (diff >= 60)
  const hueDiff = 60 + Math.floor(Math.random() * 120);
  const colorEnd = {
    h: (colorStart.h + hueDiff) % 360,
    s: Math.max(30, Math.min(90, colorStart.s + (Math.random() > 0.5 ? 15 : -15))),
    l: Math.max(35, Math.min(75, colorStart.l + (Math.random() > 0.5 ? 10 : -10))),
  };

  const truePosition = 0.15 + Math.random() * 0.7; // Avoid extreme edges (0.15 to 0.85)

  return {
    colorStart,
    colorEnd,
    truePosition,
    guessPosition: 0.5,
    score: null,
  };
}

export function setupShiftRound(): ShiftRoundData {
  // Generate 4 cohesive different colors
  const startHue = Math.floor(Math.random() * 360);
  const originalColors: HSL[] = [];
  
  for (let i = 0; i < 4; i++) {
    originalColors.push({
      h: (startHue + i * 40 + Math.floor(Math.random() * 15)) % 360,
      s: 55 + Math.floor(Math.random() * 15),
      l: 45 + Math.floor(Math.random() * 15),
    });
  }

  const shiftedIndex = Math.floor(Math.random() * 4);
  const shiftedColors = [...originalColors];
  
  // Apply a subtle shifted difference to the chosen index
  const target = originalColors[shiftedIndex];
  
  // Choose one shift dimension (Hue, Saturation, or Lightness)
  const shiftDimension = Math.floor(Math.random() * 3);
  let shifted: HSL;
  
  if (shiftDimension === 0) {
    // Hue shift by 15-25 degrees
    const dir = Math.random() > 0.5 ? 1 : -1;
    shifted = {
      ...target,
      h: (target.h + dir * (15 + Math.floor(Math.random() * 10)) + 360) % 360,
    };
  } else if (shiftDimension === 1) {
    // Saturation shift by 18-28%
    const dir = target.s > 60 ? -1 : 1;
    shifted = {
      ...target,
      s: Math.max(15, Math.min(95, target.s + dir * (18 + Math.floor(Math.random() * 10)))),
    };
  } else {
    // Lightness shift by 12-22%
    const dir = target.l > 60 ? -1 : 1;
    shifted = {
      ...target,
      l: Math.max(20, Math.min(85, target.l + dir * (12 + Math.floor(Math.random() * 10)))),
    };
  }

  shiftedColors[shiftedIndex] = shifted;

  return {
    originalColors,
    shiftedIndex,
    shiftedColors,
    userSelection: null,
  };
}

export function setupTallyRound(roundNumber: number = 1): TallyRoundData {
  // Start with smaller quantity, ramp it up in consecutive runs
  // Round 1: 5 - 7 dots
  // Round 2: 7 - 10 dots
  // Round 3: 10 - 13 dots
  // Round 4: 13 - 16 dots
  // Round 5+: 16 - 22 dots
  let minCount = 5;
  let maxCount = 7;
  
  if (roundNumber === 2) {
    minCount = 7;
    maxCount = 10;
  } else if (roundNumber === 3) {
    minCount = 10;
    maxCount = 13;
  } else if (roundNumber === 4) {
    minCount = 13;
    maxCount = 16;
  } else if (roundNumber >= 5) {
    minCount = 16;
    maxCount = Math.min(24, 15 + roundNumber);
  }

  const trueCount = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
  const points: { x: number; y: number; r: number }[] = [];
  
  // Spawn circles inside 15-85 percentage bounds so they stay nicely framed
  let attempts = 0;
  while (points.length < trueCount && attempts < 150) {
    attempts++;
    const x = Math.random() * 70 + 15;
    const y = Math.random() * 70 + 15;
    const r = Math.random() * 1.5 + 4; // 4 to 5.5px dot sizes
    
    // Check collision
    let tooClose = false;
    for (const p of points) {
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < 12) { // Spacing collision radius
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      points.push({ x, y, r });
    }
  }

  // Generate options: 4 count options. True count + 3 near neighbors.
  // E.g. True count = 14, we want 3 other options close by (e.g., 12, 15, 17)
  const optionsSet = new Set<number>([trueCount]);
  let offsetAttempts = 0;
  while (optionsSet.size < 4 && offsetAttempts < 50) {
    offsetAttempts++;
    const offset = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1); // offset of 1, 2, or 3
    const opt = trueCount + offset;
    if (opt >= 3 && opt <= 30) {
      optionsSet.add(opt);
    }
  }

  // Fallback if set didn't fill
  if (optionsSet.size < 4) {
    optionsSet.add(trueCount - 1);
    optionsSet.add(trueCount + 1);
    optionsSet.add(trueCount + 2);
  }

  const options = Array.from(optionsSet).sort((a, b) => a - b);

  return {
    points,
    trueCount,
    options,
    userSelection: null,
  };
}

// Linear color interpolation
export function interpolateHsl(colorA: HSL, colorB: HSL, fraction: number): HSL {
  // To interpolate H, handle cyclic behavior
  let hA = colorA.h;
  let hB = colorB.h;
  
  if (Math.abs(hB - hA) > 180) {
    if (hB > hA) {
      hA += 360;
    } else {
      hB += 360;
    }
  }
  
  const h = (hA + (hB - hA) * fraction) % 360;
  const s = colorA.s + (colorB.s - colorA.s) * fraction;
  const l = colorA.l + (colorB.l - colorA.l) * fraction;
  
  return { h, s, l };
}
