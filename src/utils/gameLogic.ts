/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HSL, generateRandomColor, generateSwatchOptions } from "./color";
import {
  SwatchRoundData,
  MixRoundData,
  EchoRoundData,
  EchoParams,
  BetweenRoundData,
  ShiftRoundData,
  TallyRoundData,
  TallyMode,
  TallyShape,
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

/* Difficulty ladder for Repeat the Pattern. The level is the player's
   current streak of correct answers; each rung pulls one lever:
   - levels 0-4:  playback speeds up, 600ms → 320ms per flash (the cap)
   - levels 5-9:  the board grows, 5 → 9 pads, sequence = every pad once
   - levels 10+:  repeats unlock — the sequence outgrows the board (10, 11, …)
   - levels 14+:  the board grows again, up to 12 pads, sequence keeps growing */
export function getEchoParams(level: number): EchoParams {
  const speeds = [600, 530, 460, 390, 320];
  const speed = speeds[Math.min(level, speeds.length - 1)];

  let boxes = 4;
  let seqLen = 4;
  let allowRepeat = false;

  if (level >= 5) {
    boxes = Math.min(9, 4 + (level - 4));
    seqLen = boxes;
  }
  if (level >= 10) {
    allowRepeat = true;
    boxes = 9;
    seqLen = 9 + (level - 9);
  }
  if (level >= 14) {
    boxes = Math.min(12, 9 + (level - 13));
  }

  return { boxes, seqLen, speed, allowRepeat };
}

export function setupEchoRound(params: EchoParams = getEchoParams(0)): EchoRoundData {
  const { boxes, seqLen, allowRepeat } = params;

  // Distinct cohesive colors, hues spread evenly around the wheel
  const baseHue = Math.floor(Math.random() * 360);
  const squares = Array.from({ length: boxes }, (_, id) => {
    const h = (baseHue + Math.round(id * (360 / boxes))) % 360;
    const s = 65 + Math.floor(Math.random() * 15);
    const l = 45 + Math.floor(Math.random() * 15);
    return { id, color: { h, s, l } };
  });

  let sequence: number[];
  if (allowRepeat) {
    sequence = Array.from({ length: seqLen }, () => Math.floor(Math.random() * boxes));
  } else {
    // Random permutation of all pads
    sequence = Array.from({ length: boxes }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, seqLen);
  }

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

/* Scatter non-overlapping points inside 15-85 percentage bounds */
function scatterPoints(count: number): { x: number; y: number; r: number }[] {
  const points: { x: number; y: number; r: number }[] = [];
  let attempts = 0;
  while (points.length < count && attempts < 300) {
    attempts++;
    const x = Math.random() * 70 + 15;
    const y = Math.random() * 70 + 15;
    const r = Math.random() * 1.5 + 4; // 4 to 5.5px dot sizes

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
  return points;
}

/* 4 answer options: the true count plus 3 near neighbors */
function tallyOptions(trueCount: number): number[] {
  const optionsSet = new Set<number>([trueCount]);
  let offsetAttempts = 0;
  while (optionsSet.size < 4 && offsetAttempts < 50) {
    offsetAttempts++;
    const offset = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1); // offset of 1, 2, or 3
    const opt = trueCount + offset;
    if (opt >= 1 && opt <= 30) {
      optionsSet.add(opt);
    }
  }

  // Fallback if set didn't fill
  if (optionsSet.size < 4) {
    optionsSet.add(trueCount + 1);
    optionsSet.add(trueCount + 2);
    optionsSet.add(Math.max(1, trueCount - 1));
  }

  return Array.from(optionsSet).sort((a, b) => a - b);
}

const TALLY_SHAPES: TallyShape[] = ["circle", "square", "triangle"];

export function setupTallyRound(roundNumber: number = 1, mode: TallyMode = "dots"): TallyRoundData {
  if (mode === "shapes") {
    return setupTallyShapesRound(roundNumber);
  }

  // Dots mode — quantity and speed ramp with consecutive correct runs
  // Round 1: 5 - 7 dots
  // Round 2: 7 - 10 dots
  // Round 3: 10 - 13 dots
  // Round 4: 13 - 16 dots
  // Round 5+: 16 - 24 dots
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
  const points = scatterPoints(trueCount);

  return {
    points,
    trueCount,
    options: tallyOptions(trueCount),
    userSelection: null,
    mode: "dots",
  };
}

/* Shapes mode — the alternative unlocked after counting 20+ dots. The board
   mixes circles, squares and triangles and asks for the count of ONE shape.
   Difficulty grows through quantity, not speed. */
export function setupTallyShapesRound(roundNumber: number = 1): TallyRoundData {
  const total = Math.min(26, 11 + (roundNumber - 1) * 3);
  const bare = scatterPoints(total);

  // Deal shapes out evenly, then shuffle positions so no shape clusters
  const deck: TallyShape[] = bare.map((_, i) => TALLY_SHAPES[i % TALLY_SHAPES.length]);
  deck.sort(() => Math.random() - 0.5);
  const points = bare.map((p, i) => ({ ...p, shape: deck[i] }));

  const targetShape = TALLY_SHAPES[Math.floor(Math.random() * TALLY_SHAPES.length)];
  const trueCount = points.filter((p) => p.shape === targetShape).length;

  return {
    points,
    trueCount,
    options: tallyOptions(trueCount),
    userSelection: null,
    mode: "shapes",
    targetShape,
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
