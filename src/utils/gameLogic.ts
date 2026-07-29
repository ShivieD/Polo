/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HSL, generateRandomColor, generateSwatchOptions } from "./color";
import { shuffleArray } from "./shuffle";
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

/* Color Match: the level adds distractor tiles — L1 has 5 impostors,
   each level adds one more (L6 = 10 impostors + the true color). */
export function setupSwatchRound(ramp = 1): SwatchRoundData {
  const targetColor = generateRandomColor();
  const level = Math.max(1, Math.min(6, Math.floor(ramp + 0.4)));
  const options = generateSwatchOptions(targetColor, 4 + level);
  return {
    targetColor,
    options,
    userSelection: null,
  };
}

/* Color Mixer rounds by level:
   L1 hue dial only (sat/light inherited from the target),
   L2 +saturation, L3 +lightness (the classic three-dial mix),
   L4 +opacity over a checkerboard,
   L5 two overlapping half-opacity circles — sat/light lock, one hue dial
      per circle, the target is their intersection,
   L6 a third circle joins; the target is the triple intersection. */
export function setupMixRound(level = 3): MixRoundData {
  const targetColor = generateRandomColor();
  const hOffset = 120 + Math.floor(Math.random() * 120);
  const sOffset = (Math.random() > 0.5 ? 1 : -1) * (20 + Math.floor(Math.random() * 15));
  const lOffset = (Math.random() > 0.5 ? 1 : -1) * (15 + Math.floor(Math.random() * 15));

  if (level >= 5) {
    /* Blend levels: keep the body colors juicy so the average stays legible */
    const base = {
      h: targetColor.h,
      s: 60 + Math.floor(Math.random() * 20),
      l: 48 + Math.floor(Math.random() * 12),
    };
    const n = level >= 6 ? 3 : 2;
    const targetHues = Array.from({ length: n }, (_, i) =>
      Math.round((base.h + i * (110 + Math.random() * 40)) % 360)
    );
    const userHues = targetHues.map(
      (h) => Math.round(h + 90 + Math.random() * 180) % 360
    );
    return {
      targetColor: base,
      userColor: { ...base, h: userHues[0] },
      targetHues,
      userHues,
      score: null,
    };
  }

  const userColor = {
    h: (targetColor.h + hOffset) % 360,
    s: level >= 2 ? Math.max(15, Math.min(95, targetColor.s + sOffset)) : targetColor.s,
    l: level >= 3 ? Math.max(20, Math.min(85, targetColor.l + lOffset)) : targetColor.l,
  };

  if (level >= 4) {
    const targetAlpha = 0.4 + Math.floor(Math.random() * 11) * 0.05; // 0.40-0.90
    let userAlpha = 0.4 + Math.floor(Math.random() * 11) * 0.05;
    if (Math.abs(userAlpha - targetAlpha) < 0.15) {
      userAlpha = targetAlpha >= 0.65 ? targetAlpha - 0.25 : targetAlpha + 0.25;
    }
    return {
      targetColor,
      userColor,
      targetAlpha: Math.round(targetAlpha * 100) / 100,
      userAlpha: Math.round(userAlpha * 100) / 100,
      score: null,
    };
  }

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
/* Fixed 6-rung ladder — every rung moves the sequence, not just the clock.
   L2 can't grow the 2x2 board usefully, so the sequence outgrows it
   instead (a pad repeats). Fed a FLOAT level (the run ramp): speed
   interpolates continuously, board/sequence bump near the cycle's end. */
const ECHO_TABLE = [
  { boxes: 4, seqLen: 4, speed: 600 },
  { boxes: 4, seqLen: 5, speed: 520 },
  { boxes: 5, seqLen: 5, speed: 460 },
  { boxes: 6, seqLen: 6, speed: 400 },
  { boxes: 7, seqLen: 8, speed: 360 },
  { boxes: 9, seqLen: 10, speed: 320 },
];
export const getEchoParamsForLevel = (ramp: number): EchoParams => {
  const t = Math.max(1, Math.min(6, ramp));
  const lo = ECHO_TABLE[Math.floor(t) - 1];
  const hi = ECHO_TABLE[Math.min(6, Math.ceil(t)) - 1];
  const frac = t - Math.floor(t);
  /* Discrete knobs bump on the cycle's back half */
  const disc = frac >= 0.6 ? hi : lo;
  const boxes = disc.boxes;
  const seqLen = disc.seqLen;
  return {
    boxes,
    seqLen,
    speed: Math.round(lo.speed + (hi.speed - lo.speed) * frac),
    allowRepeat: seqLen > boxes,
  };
};

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
    /* Every pad appears at least once, then the overflow re-draws pads at
       random — the repeat is guaranteed, its position isn't */
    const base = shuffleArray(Array.from({ length: boxes }, (_, i) => i));
    const extra = Array.from({ length: seqLen - boxes }, () => Math.floor(Math.random() * boxes));
    sequence = shuffleArray([...base, ...extra]);
  } else {
    // Random permutation of all pads
    sequence = shuffleArray(Array.from({ length: boxes }, (_, i) => i)).slice(0, seqLen);
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

/* Spot the Difference: the level adds a tile — L1 is the classic 4,
   L6 reaches 9. */
export function setupShiftRound(ramp = 1): ShiftRoundData {
  const tiles = 3 + Math.max(1, Math.min(6, Math.floor(ramp + 0.4)));
  const startHue = Math.floor(Math.random() * 360);
  const originalColors: HSL[] = [];

  for (let i = 0; i < tiles; i++) {
    originalColors.push({
      h: (startHue + i * Math.floor(360 / tiles) + Math.floor(Math.random() * 15)) % 360,
      s: 55 + Math.floor(Math.random() * 15),
      l: 45 + Math.floor(Math.random() * 15),
    });
  }

  const shiftedIndex = Math.floor(Math.random() * tiles);
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
  /* Dense boards (25+) need a tighter packing radius to physically fit */
  const spacing = count > 24 ? 9.5 : 12;
  while (points.length < count && attempts < 900) {
    attempts++;
    const x = Math.random() * 70 + 15;
    const y = Math.random() * 70 + 15;
    const r = Math.random() * 1.5 + 4; // 4 to 5.5px dot sizes

    let tooClose = false;
    for (const p of points) {
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < spacing) { // Spacing collision radius
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

/* Piece-count BANDS per level, both tally modes, hard-capped at 30.
   Every run draws fresh from its band so two runs of the same level
   rarely share a count; the band's floor also creeps up across the
   5-run cycle (the fractional part of the ramp). */
export const TALLY_LEVEL_BANDS: [number, number][] = [
  [5, 7],
  [8, 11],
  [12, 15],
  [16, 20],
  [21, 25],
  [26, 30],
];
const tallyCountFor = (ramp: number) => {
  const t = Math.max(1, Math.min(6, ramp));
  const [lo, hi] = TALLY_LEVEL_BANDS[Math.floor(t) - 1];
  const creep = Math.round((t - Math.floor(t)) * (hi - lo) * 0.5);
  const min = Math.min(30, lo + creep);
  return Math.min(30, min + Math.floor(Math.random() * (hi - min + 1)));
};

/* Dots-mode drop tempo, ms per piece, interpolated along the ramp */
const TALLY_SPEED = [250, 215, 180, 150, 120, 95];
export const getTallyPopSpeed = (ramp: number): number => {
  const t = Math.max(1, Math.min(6, ramp));
  const lo = TALLY_SPEED[Math.floor(t) - 1];
  const hi = TALLY_SPEED[Math.min(6, Math.ceil(t)) - 1];
  return Math.round(lo + (hi - lo) * (t - Math.floor(t)));
};

export function setupTallyRound(ramp: number = 1, mode: TallyMode = "dots"): TallyRoundData {
  if (mode === "shapes") {
    return setupTallyShapesRound(ramp);
  }

  const points = scatterPoints(tallyCountFor(ramp));
  /* The scatter is best-effort at dense counts — count what actually landed */
  const trueCount = points.length;

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
export function setupTallyShapesRound(ramp: number = 1): TallyRoundData {
  const bare = scatterPoints(tallyCountFor(ramp));

  // Deal shapes out evenly, then shuffle positions so no shape clusters
  const deck: TallyShape[] = shuffleArray(bare.map((_, i) => TALLY_SHAPES[i % TALLY_SHAPES.length]));
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
