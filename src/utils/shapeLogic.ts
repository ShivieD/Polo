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

import { shuffleArray as shuffle } from "./shuffle";

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const clampLevel = (level: number, max = 6): ShapeLevel =>
  Math.max(1, Math.min(max, Math.round(level))) as ShapeLevel;

/* Run-ramp plumbing: getters take a FLOAT level (level + cycle fraction).
   Continuous knobs lerp between adjacent table rows; discrete knobs jump
   to the next row on the cycle's back half (frac >= 0.6). */
const rampParts = (ramp: number, max = 6) => {
  const t = Math.max(1, Math.min(max, ramp));
  return { lo: Math.floor(t) - 1, hi: Math.min(max, Math.ceil(t)) - 1, frac: t - Math.floor(t) };
};
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

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
export const FORM_MAX_LEVEL = 8;

/* The L1→L8 ramp trades one knob at a time, in smaller steps than v1 so the
   difficulty doesn't cliff: families → neighbors → mixed → coarse aspect →
   fine aspect → paint → ±12% size → ±7% size. */
export function setupFormRound(rampIn: number): FormRoundData {
  /* Run ramp: recipes bump on the cycle's back half; inside a recipe the
     numeric knobs tighten with cycle progress so every run is a shade
     harder than the last. */
  const t = Math.max(1, Math.min(FORM_MAX_LEVEL, rampIn));
  const fl = Math.floor(t);
  const rawFrac = t - fl;
  const level = rawFrac >= 0.6 ? Math.min(FORM_MAX_LEVEL, fl + 1) : fl;
  const f = rawFrac >= 0.6 ? 0 : rawFrac / 0.6; // progress within this recipe
  const mixT = (a: number, b: number) => a + (b - a) * f;
  const kind = pick(ALL_KINDS);
  let specs: ShapeSpec[];
  let targetIdx: number;

  if (level === 1) {
    /* Two near-neighbors are in the lineup from the very first run — an
       all-distinct-families board was a freebie — and the rest crowd in
       run by run until L1 ends on a full neighbor set. */
    const neighborCount = 2 + Math.round(f * 3);
    const neighbors = SIMILAR[kind].slice(0, neighborCount);
    const fillers = shuffle(ALL_KINDS.filter((k) => k !== kind && !neighbors.includes(k))).slice(
      0,
      5 - neighborCount
    );
    const kinds = [kind, ...neighbors, ...fillers];
    specs = kinds.map((k) => ({ kind: k }));
    targetIdx = 0;
  } else if (level === 2) {
    /* Four near-neighbors plus two stretched twins of the target itself —
       same silhouette, wrong proportion — which tighten run by run */
    specs = [
      { kind },
      ...SIMILAR[kind].slice(0, 4).map((k) => ({ kind: k })),
      { kind, aspect: mixT(0.62, 0.78) },
    ];
    targetIdx = 0;
  } else if (level === 3) {
    /* Near-neighbors plus stretched twins that straighten out run by run */
    specs = [
      { kind },
      ...SIMILAR[kind].slice(0, 3).map((k) => ({ kind: k })),
      { kind, aspect: mixT(0.6, 0.74) },
      { kind, aspect: mixT(1.55, 1.32) },
    ];
    targetIdx = 0;
  } else if (level === 4) {
    /* Same shape, aspect ratios drifting from blatant toward subtle */
    const a4 = [1, 0.5, 0.7, 1.4, 1.9, 0.33];
    const a5 = [1, 0.72, 0.85, 1.18, 1.4, 0.6];
    const aspects = shuffle(a4.map((a, i) => mixT(a, a5[i])));
    specs = aspects.map((aspect) => ({ kind, aspect }));
    targetIdx = aspects.indexOf(1);
  } else if (level === 5) {
    /* Same shape, subtler aspect ratios, converging further per run */
    const a5 = [1, 0.72, 0.85, 1.18, 1.4, 0.6];
    const a5b = [1, 0.8, 0.9, 1.12, 1.26, 0.68];
    const aspects = shuffle(a5.map((a, i) => mixT(a, a5b[i])));
    specs = aspects.map((aspect) => ({ kind, aspect }));
    targetIdx = aspects.indexOf(1);
  } else if (level === 6) {
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
    /* L7→L8: proportional size steps shrink continuously 12% → 7% */
    const step = level === 7 ? mixT(0.12, 0.095) : mixT(0.095, 0.07);
    const base = 0.72;
    const factors = shuffle([0, 1, 2, -1, -2, 3].map((k) => Math.pow(1 + step, k)));
    specs = factors.map((f) => ({ kind, scale: Math.min(1, base * f) }));
    targetIdx = randInt(0, 5);
  }

  const order = shuffle(specs.map((_, i) => i));
  const options = order.map((i) => ({ spec: specs[i], isCorrect: i === targetIdx }));
  return { target: specs[targetIdx], options, userSelection: null };
}

const KIND_LABEL: Record<ShapeKind, string> = {
  square: "square",
  circle: "circle",
  triangle: "triangle",
  plus: "plus",
  hexagon: "hexagon",
  halfCircle: "half-circle",
  cross: "cross",
  arrow: "arrow",
};

/* Explain a Shape Match miss in terms of the ACTUAL difference between the
   picked shape and the target, so the feedback always fits the mistake. */
export function explainFormMiss(target: ShapeSpec, picked: ShapeSpec): string {
  if (picked.kind !== target.kind) {
    return `You picked the ${KIND_LABEL[picked.kind]} — the target was the ${KIND_LABEL[target.kind]}.`;
  }
  const tFilled = target.filled ?? true;
  const pFilled = picked.filled ?? true;
  if (tFilled !== pFilled) {
    return pFilled
      ? "Yours was the filled one — the target was outlined."
      : "Yours was outlined — the target was the filled one.";
  }
  if (!tFilled && (picked.strokeW ?? 7) !== (target.strokeW ?? 7)) {
    return (picked.strokeW ?? 7) > (target.strokeW ?? 7)
      ? "Same shape, but your outline was heavier than the target's."
      : "Same shape, but your outline was lighter than the target's.";
  }
  const tAspect = target.aspect ?? 1;
  const pAspect = picked.aspect ?? 1;
  if (Math.abs(tAspect - pAspect) > 0.01) {
    return pAspect > tAspect
      ? "Same shape, but yours was stretched wider than the target."
      : "Same shape, but yours was squeezed taller than the target.";
  }
  const tScale = target.scale ?? 1;
  const pScale = picked.scale ?? 1;
  if (Math.abs(tScale - pScale) > 0.001) {
    const pct = Math.max(1, Math.round((Math.abs(pScale - tScale) / tScale) * 100));
    return pScale > tScale
      ? `Same shape, but yours was about ${pct}% larger than the target.`
      : `Same shape, but yours was about ${pct}% smaller than the target.`;
  }
  return "A twin got you — at this level the differences are razor thin.";
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

export const getTiltParams = (ramp: number) => {
  const { lo, hi, frac } = rampParts(ramp);
  return {
    exposure: Math.round(lerp(TILT_TABLE[lo].exposure, TILT_TABLE[hi].exposure, frac)),
    tolerance: lerp(TILT_TABLE[lo].tolerance, TILT_TABLE[hi].tolerance, frac),
  };
};

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

export const getChainParams = (ramp: number): ChainParams => {
  const { lo, hi, frac } = rampParts(ramp);
  return CHAIN_TABLE[frac >= 0.6 ? hi : lo];
};

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

export const getSquircleParams = (ramp: number) => {
  const { lo, hi, frac } = rampParts(ramp);
  return {
    exposure: Math.round(lerp(SQUIRCLE_TABLE[lo].exposure, SQUIRCLE_TABLE[hi].exposure, frac)),
    tolerance: lerp(SQUIRCLE_TABLE[lo].tolerance, SQUIRCLE_TABLE[hi].tolerance, frac),
  };
};

/* Every 20 passed rounds one more corner breaks away from the rest —
   and the exposure timer resets to the full two seconds. */
export const SQUIRCLE_PASSES_PER_PHASE = 20;
export const getSquirclePhase = (passes: number) => Math.min(3, Math.floor(passes / SQUIRCLE_PASSES_PER_PHASE));

/* Stratified base radius: pick a band first so targets stop clumping in the
   comfortable middle of the range. */
const radiusInBand = () => {
  const bands: [number, number][] = [
    [2, 11],
    [11, 21],
    [21, 31],
    [31, MAX_RADIUS],
  ];
  const [lo, hi] = pick(bands);
  return rand(lo, hi);
};

export function setupSquircleRound(passes: number): SquircleRoundData {
  const phase = getSquirclePhase(passes);
  const base = radiusInBand();
  const trueRadii: [number, number, number, number] = [base, base, base, base];

  /* In phase k, k distinct corners drift from the base by a visible margin */
  const corners = shuffle([0, 1, 2, 3]).slice(0, phase);
  for (const c of corners) {
    const delta = rand(10, 18);
    const up = base + delta <= MAX_RADIUS ? Math.random() > 0.5 : false;
    const down = base - delta >= 0;
    trueRadii[c] = up || !down ? Math.min(MAX_RADIUS, base + delta) : Math.max(0, base - delta);
  }

  return { trueRadii, guessRadii: [0, 0, 0, 0], phase, score: null };
}

export function scoreSquircle(
  guess: [number, number, number, number],
  truth: [number, number, number, number],
  level: number
): number {
  const { tolerance } = getSquircleParams(level);
  const err = guess.reduce((sum, g, i) => sum + Math.abs(g - truth[i]), 0) / 4;
  if (err <= tolerance * MAX_RADIUS) return 100;
  return Math.round(Math.max(0, 100 * (1 - err / MAX_RADIUS)));
}

/* ------------------------------------------------------------------ */
/* Spot the Shift — magnitude of the change shrinks per level           */
/* ------------------------------------------------------------------ */

/* Instead of a monotonic magnitude ladder (which walls players around round
   six), every round draws a difficulty TIER from a level-weighted mix:
   - swap:   the changed shape comes back as a different shape entirely (easy)
   - coarse: a big attribute change, 25-35 (medium)
   - fine:   a subtle change from the per-level table (hard)
   Higher levels skew harder but easy rounds never fully disappear. */
const SHIFT_FINE_MAGNITUDE = [14, 11, 9, 7, 5, 3.5];
/* L1 used to be half free swaps and no subtle rounds at all, which made the
   opening levels a formality. Swaps are cut back and a real share of fine
   rounds is present from L1 — the ladder still climbs, it just starts
   somewhere worth playing. */
const SHIFT_TIER_WEIGHTS: [number, number, number][] = [
  [0.18, 0.5, 0.32],
  [0.14, 0.45, 0.41],
  [0.11, 0.39, 0.5],
  [0.09, 0.33, 0.58],
  [0.07, 0.28, 0.65],
  [0.05, 0.23, 0.72],
];

/* Kinds where every change type stays visible (no circles — rotation
   would be a no-op) */
const SHIFT_KINDS: ShapeKind[] = ["square", "triangle", "arrow", "hexagon", "plus"];

/* How often a round is a LINEUP — four different shapes with one swapped
   for a fifth kind — rather than four identical shapes with one attribute
   drifting. Constant across levels so the challenge TYPE stays
   unpredictable from round one; the attribute rounds carry the
   level-driven subtlety ramp. */
const SHIFT_LINEUP_CHANCE = 0.22;

/* A lineup round: every cell its own shape, the changed one comes back as
   a fifth kind not present in the original four. */
function setupShiftLineupRound(): ShapeShiftRoundData {
  const kinds = shuffle(ALL_KINDS).slice(0, 5);
  const rotation = randInt(-8, 8);
  const specFor = (kind: ShapeKind): ShapeSpec => ({
    kind,
    scale: 0.82,
    rotation: kind === "square" ? 0 : rotation,
    radius: kind === "square" ? randInt(8, 16) : undefined,
  });
  const cellSpecs = kinds.slice(0, 4).map(specFor);
  const changedIndex = randInt(0, 3);
  return {
    baseSpec: cellSpecs[changedIndex],
    cellSpecs,
    changedIndex,
    changedSpec: specFor(kinds[4]),
    changeKind: "swap",
    userSelection: null,
  };
}

export function setupShapeShiftRound(rampIn: number): ShapeShiftRoundData {
  if (Math.random() < SHIFT_LINEUP_CHANCE) return setupShiftLineupRound();

  const { lo, hi, frac } = rampParts(rampIn);
  const level = clampLevel(rampIn);
  const wSwap = lerp(SHIFT_TIER_WEIGHTS[lo][0], SHIFT_TIER_WEIGHTS[hi][0], frac);
  const wCoarse = lerp(SHIFT_TIER_WEIGHTS[lo][1], SHIFT_TIER_WEIGHTS[hi][1], frac);
  const roll = Math.random();
  const tier = roll < wSwap ? "swap" : roll < wSwap + wCoarse ? "coarse" : "fine";

  const kind = pick(SHIFT_KINDS);
  const baseSpec: ShapeSpec = {
    kind,
    scale: 0.82,
    rotation: kind === "square" ? 0 : randInt(-8, 8),
    radius: kind === "square" ? randInt(8, 16) : undefined,
  };

  let changeKind: ShapeChangeKind;
  const changedSpec: ShapeSpec = { ...baseSpec };

  if (tier === "swap") {
    changeKind = "swap";
    changedSpec.kind = pick(ALL_KINDS.filter((k) => k !== kind));
    if (changedSpec.kind !== "square") changedSpec.radius = undefined;
  } else {
    const mag =
      tier === "coarse"
        ? rand(19, 28)
        : lerp(SHIFT_FINE_MAGNITUDE[lo], SHIFT_FINE_MAGNITUDE[hi], frac);
    const kinds: ShapeChangeKind[] = kind === "square" ? ["rotation", "size", "radius"] : ["rotation", "size"];
    changeKind = pick(kinds);
    const dir = Math.random() > 0.5 ? 1 : -1;

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
  }

  return { baseSpec, changedIndex: randInt(0, 3), changedSpec, changeKind, userSelection: null };
}

/* ------------------------------------------------------------------ */
/* Count the Shapes — exposure and distractor closeness per level       */
/* ------------------------------------------------------------------ */

/* Pieces drop one at a time (with a tick each, like Count it All); the
   per-level squeeze is the drop tempo plus how close the wrong options sit */
const SHAPE_TALLY_TABLE = [
  { popSpeed: 260, offsets: [2, 3] },
  { popSpeed: 225, offsets: [2] },
  { popSpeed: 190, offsets: [1, 2] },
  { popSpeed: 155, offsets: [1] },
  { popSpeed: 120, offsets: [1] },
  { popSpeed: 90, offsets: [1] },
];

export const getShapeTallyParams = (ramp: number) => {
  const { lo, hi, frac } = rampParts(ramp);
  return {
    popSpeed: Math.round(lerp(SHAPE_TALLY_TABLE[lo].popSpeed, SHAPE_TALLY_TABLE[hi].popSpeed, frac)),
    offsets: SHAPE_TALLY_TABLE[frac >= 0.6 ? hi : lo].offsets,
  };
};

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
