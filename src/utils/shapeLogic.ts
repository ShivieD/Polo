/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ShapeKind,
  ShapeSpec,
  ShapeLevel,
  FormRoundData,
  TiltRoundData,
  ChainRoundData,
  ChainParams,
  SquircleRoundData,
  ShapeShiftRoundData,
  ShapeChangeKind,
  ShapeTallyRoundData,
} from "../types";

/*
 * Round setup for the six Shapes-mode instruments. Every game climbs a fixed
 * L1→L6 schedule — one rung per round, wrong answers never roll it back —
 * and each level table below pulls exactly one difficulty lever.
 */

const ALL_KINDS: ShapeKind[] = ["square", "circle", "triangle", "plus", "hexagon", "halfCircle", "cross", "arrow"];

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const clampLevel = (level: number): ShapeLevel => Math.max(1, Math.min(6, Math.round(level))) as ShapeLevel;

/* ------------------------------------------------------------------ */
/* Shape Match (Form) — distractor similarity tightens per level        */
/* ------------------------------------------------------------------ */

/* For each kind, the other kinds ranked from most to least confusable —
   L2 draws its five distractors from the front of this list. */
const SIMILAR: Record<ShapeKind, ShapeKind[]> = {
  square: ["hexagon", "circle", "plus", "cross", "halfCircle", "triangle", "arrow"],
  circle: ["hexagon", "halfCircle", "square", "plus", "cross", "triangle", "arrow"],
  triangle: ["arrow", "halfCircle", "cross", "plus", "hexagon", "square", "circle"],
  plus: ["cross", "square", "arrow", "hexagon", "triangle", "circle", "halfCircle"],
  hexagon: ["circle", "square", "halfCircle", "plus", "cross", "triangle", "arrow"],
  halfCircle: ["circle", "hexagon", "triangle", "arrow", "square", "plus", "cross"],
  cross: ["plus", "arrow", "triangle", "square", "hexagon", "circle", "halfCircle"],
  arrow: ["triangle", "cross", "plus", "halfCircle", "hexagon", "square", "circle"],
};

export const FORM_EXPOSURE_MS = 2000;

export function setupFormRound(levelIn: number): FormRoundData {
  const level = clampLevel(levelIn);
  const kind = pick(ALL_KINDS);
  let specs: ShapeSpec[];
  let targetIdx: number;

  if (level === 1) {
    /* Six clearly distinct shape families */
    const kinds = shuffle(ALL_KINDS).slice(0, 6);
    specs = kinds.map((k) => ({ kind: k }));
    targetIdx = randInt(0, 5);
  } else if (level === 2) {
    /* Target plus five near-neighbors from adjacent families */
    specs = [{ kind }, ...SIMILAR[kind].slice(0, 5).map((k) => ({ kind: k }))];
    targetIdx = 0;
  } else if (level === 3) {
    /* Same shape, different aspect ratios */
    const aspects = shuffle([1, 0.62, 0.78, 0.9, 1.16, 1.38]);
    specs = aspects.map((aspect) => ({ kind, aspect }));
    targetIdx = randInt(0, 5);
  } else if (level === 4) {
    /* Same shape, varying line weight or fill */
    const paints: Partial<ShapeSpec>[] = shuffle([
      { filled: true },
      { filled: false, strokeW: 4 },
      { filled: false, strokeW: 7 },
      { filled: false, strokeW: 11 },
      { filled: false, strokeW: 16 },
      { filled: false, strokeW: 22 },
    ]);
    specs = paints.map((p) => ({ kind, ...p }));
    targetIdx = randInt(0, 5);
  } else {
    /* L5 ~10% / L6 ~5% proportional variations of the same shape */
    const step = level === 5 ? 0.1 : 0.05;
    const base = 0.74;
    const factors = shuffle([0, 1, 2, -1, -2, 3].map((k) => Math.pow(1 + step, k)));
    specs = factors.map((f) => ({ kind, scale: Math.min(1, base * f) }));
    targetIdx = randInt(0, 5);
  }

  const order = shuffle(specs.map((_, i) => i));
  const options = order.map((i) => ({ spec: specs[i], isCorrect: i === targetIdx }));
  return { target: specs[targetIdx], options, userSelection: null };
}

/* ------------------------------------------------------------------ */
/* Match the Tilt — exposure and tolerance tighten per level            */
/* ------------------------------------------------------------------ */

const TILT_TABLE = [
  { exposure: 2000, tolerance: 5 },
  { exposure: 1500, tolerance: 4 },
  { exposure: 1200, tolerance: 3 },
  { exposure: 1000, tolerance: 2.5 },
  { exposure: 800, tolerance: 2 },
  { exposure: 600, tolerance: 1.5 },
];

export const getTiltParams = (level: number) => TILT_TABLE[clampLevel(level) - 1];

export function setupTiltRound(): TiltRoundData {
  const trueAngle = rand(0, 180);
  /* Start the answer line perpendicular so a no-op drag never scores */
  return { trueAngle, guessAngle: (trueAngle + 90) % 180, score: null };
}

/* A line has no direction — the gap between two line angles is at most 90° */
export const tiltDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
};

export function scoreTilt(guess: number, truth: number, level: number): number {
  const { tolerance } = getTiltParams(level);
  const diff = tiltDiff(guess, truth);
  if (diff <= tolerance) return 100;
  return Math.round(Math.max(0, 100 * (1 - (diff - tolerance) / (90 - tolerance))));
}

/* ------------------------------------------------------------------ */
/* Repeat the Chain — length and shape similarity grow per level        */
/* ------------------------------------------------------------------ */

const CHAIN_TABLE: ChainParams[] = [
  { len: 4, poolSize: 4, allowRepeat: false, sameFamily: false },
  { len: 5, poolSize: 5, allowRepeat: false, sameFamily: false },
  { len: 6, poolSize: 6, allowRepeat: false, sameFamily: false },
  { len: 6, poolSize: 4, allowRepeat: true, sameFamily: false },
  { len: 7, poolSize: 5, allowRepeat: true, sameFamily: false },
  { len: 7, poolSize: 4, allowRepeat: true, sameFamily: true },
];

export const getChainParams = (level: number): ChainParams => CHAIN_TABLE[clampLevel(level) - 1];

export const CHAIN_STEP_MS = 600;

/* Visual families for L6 — everything in one pool reads alike */
const FAMILY_POOLS: ShapeKind[][] = [
  ["circle", "halfCircle", "hexagon", "square"],
  ["triangle", "arrow", "cross", "plus"],
];

export function setupChainRound(levelIn: number): ChainRoundData {
  const { len, poolSize, allowRepeat, sameFamily } = getChainParams(levelIn);
  const source = sameFamily ? pick(FAMILY_POOLS) : ALL_KINDS;
  const pool = shuffle(source).slice(0, poolSize);

  let sequence: ShapeKind[];
  if (allowRepeat) {
    /* Random draws, re-rolled until at least one shape actually repeats */
    do {
      sequence = Array.from({ length: len }, () => pick(pool));
    } while (new Set(sequence).size === sequence.length);
  } else {
    sequence = shuffle(pool).slice(0, len);
  }

  return { pool, sequence, userSeq: [], isCorrect: null };
}

/* ------------------------------------------------------------------ */
/* Round the Corner — exposure and radius tolerance tighten per level   */
/* ------------------------------------------------------------------ */

/* Radius is expressed as % of side length, capped at 40 so the squircle
   never collapses into a full circle (that would be 50). */
export const MAX_RADIUS = 40;

const SQUIRCLE_TABLE = [
  { exposure: 2000, tolerance: 0.1 },
  { exposure: 1600, tolerance: 0.08 },
  { exposure: 1300, tolerance: 0.06 },
  { exposure: 1000, tolerance: 0.05 },
  { exposure: 800, tolerance: 0.04 },
  { exposure: 600, tolerance: 0.03 },
];

export const getSquircleParams = (level: number) => SQUIRCLE_TABLE[clampLevel(level) - 1];

export function setupSquircleRound(): SquircleRoundData {
  return { trueRadius: rand(4, MAX_RADIUS), guessRadius: 0, score: null };
}

export function scoreSquircle(guess: number, truth: number, level: number): number {
  const { tolerance } = getSquircleParams(level);
  const diff = Math.abs(guess - truth);
  if (diff <= tolerance * MAX_RADIUS) return 100;
  return Math.round(Math.max(0, 100 * (1 - diff / MAX_RADIUS)));
}

/* ------------------------------------------------------------------ */
/* Spot the Shift — magnitude of the change shrinks per level           */
/* ------------------------------------------------------------------ */

/* One number per level: degrees for rotation, % for size and radius */
const SHIFT_MAGNITUDE = [30, 20, 15, 10, 7, 4];

export const getShiftMagnitude = (level: number) => SHIFT_MAGNITUDE[clampLevel(level) - 1];

/* Kinds where every change type stays visible (no circles — rotation
   would be a no-op) */
const SHIFT_KINDS: ShapeKind[] = ["square", "triangle", "arrow", "hexagon", "plus"];

export function setupShapeShiftRound(levelIn: number): ShapeShiftRoundData {
  const mag = getShiftMagnitude(levelIn);
  const kind = pick(SHIFT_KINDS);
  const baseSpec: ShapeSpec = {
    kind,
    scale: 0.82,
    rotation: kind === "square" ? 0 : randInt(-8, 8),
    radius: kind === "square" ? randInt(8, 16) : undefined,
  };

  const changeKinds: ShapeChangeKind[] = kind === "square" ? ["rotation", "size", "radius"] : ["rotation", "size"];
  const changeKind = pick(changeKinds);
  const dir = Math.random() > 0.5 ? 1 : -1;

  const changedSpec: ShapeSpec = { ...baseSpec };
  if (changeKind === "rotation") {
    changedSpec.rotation = (baseSpec.rotation ?? 0) + dir * mag;
  } else if (changeKind === "size") {
    const factor = 1 + (dir * mag) / 100;
    changedSpec.scale = Math.max(0.35, Math.min(1, (baseSpec.scale ?? 1) * factor));
  } else {
    const delta = (mag / 100) * MAX_RADIUS;
    const base = baseSpec.radius ?? 12;
    /* Push away from the clamp edge so the delta always survives */
    const d = base + delta > MAX_RADIUS ? -delta : base - delta < 2 ? delta : dir * delta;
    changedSpec.radius = Math.max(2, Math.min(MAX_RADIUS, base + d));
  }

  return { baseSpec, changedIndex: randInt(0, 3), changedSpec, changeKind, userSelection: null };
}

/* ------------------------------------------------------------------ */
/* Count the Shapes — exposure and distractor closeness per level       */
/* ------------------------------------------------------------------ */

const SHAPE_TALLY_TABLE = [
  { exposure: 1500, offsets: [2, 3] },
  { exposure: 1300, offsets: [2] },
  { exposure: 1100, offsets: [1, 2] },
  { exposure: 900, offsets: [1] },
  { exposure: 700, offsets: [1] },
  { exposure: 500, offsets: [1] },
];

export const getShapeTallyParams = (level: number) => SHAPE_TALLY_TABLE[clampLevel(level) - 1];

/* Scatter non-overlapping points inside 15-85 percentage bounds
   (same physics as Color-mode Tally) */
function scatterPoints(count: number): { x: number; y: number; r: number }[] {
  const points: { x: number; y: number; r: number }[] = [];
  let attempts = 0;
  while (points.length < count && attempts < 300) {
    attempts++;
    const x = Math.random() * 70 + 15;
    const y = Math.random() * 70 + 15;
    const r = Math.random() * 1.5 + 4;
    if (points.every((p) => Math.hypot(p.x - x, p.y - y) >= 12)) {
      points.push({ x, y, r });
    }
  }
  return points;
}

/* 4 options: the true count plus 3 neighbors at the level's allowed offsets,
   spilling one tier out when the near slots are exhausted */
function shapeTallyOptions(trueCount: number, offsets: number[]): number[] {
  const options = new Set<number>([trueCount]);
  const tiers = [...offsets, ...offsets.map((o) => o * 2), ...offsets.map((o) => o * 3)];
  for (const o of tiers) {
    if (options.size >= 4) break;
    for (const signed of shuffle([o, -o])) {
      if (options.size >= 4) break;
      const opt = trueCount + signed;
      if (opt >= 1) options.add(opt);
    }
  }
  return Array.from(options).sort((a, b) => a - b);
}

export function setupShapeTallyRound(levelIn: number): ShapeTallyRoundData {
  const level = clampLevel(levelIn);
  const { offsets } = getShapeTallyParams(level);
  const trueCount = randInt(6 + level, 10 + level);
  return {
    points: scatterPoints(trueCount),
    piece: Math.random() > 0.35 ? "circle" : "square",
    trueCount,
    options: shapeTallyOptions(trueCount, offsets),
    userSelection: null,
  };
}
