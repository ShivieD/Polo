/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameId } from "../types";

/*
 * Progression engine — one state machine shared by all twelve instruments.
 *
 * Levels: each level is a cycle of 5 runs. Advancing requires all 5 runs
 * in the cycle to be CLEAN passes (no lives spent). A miss with reserve
 * lives spends one life: the streak survives, but that run is not a clean
 * pass, so the cycle can no longer promote — the level replays. A miss
 * with no lives breaks the streak and restarts the cycle from run 1.
 *
 * Lives: start full at 5, +1 on every level-up, capped at 5. When lives
 * drop to exactly 1, the UI is told to offer a points-for-life trade.
 *
 * Points: flat, never level-weighted. Score-based instruments bank their
 * 0-100 round score; hit/miss instruments bank 100 per catch. Points and
 * best-streak are the permanent leaderboard record — a player-triggered
 * reset clears only live play state (level, lives, current streak, cycle),
 * never the banked record.
 */

export const RUNS_PER_LEVEL = 5;
export const MAX_LIVES = 5;
export const START_LIVES = 5;

export interface GameProgress {
  level: number;
  lives: number;
  streakCurrent: number;
  streakBest: number;
  pointsTotal: number;
  runsInLevel: number;
  cleanPassesInLevel: number;
  /* Best single-run score ever banked (100 for hit/miss instruments) */
  bestRunScore: number;
}

export interface RunOutcome {
  kind: "pass" | "lifeSaved" | "streakBroken";
  leveledUp: boolean;
  /* Cycle finished without 5 clean passes — same level replays */
  cycleFailed: boolean;
  newLevel: number;
  pointsEarned: number;
  livesLeft: number;
  /* Lives just dropped to exactly 1 — offer the points-for-life trade */
  promptBuyLife: boolean;
  /* Player just reached the max level for this game */
  mastered: boolean;
}

/* ------------------------------------------------------------------ */
/* Static config                                                       */
/* ------------------------------------------------------------------ */

export const MAX_LEVEL: Record<GameId, number> = {
  swatch: 6, mix: 6, echo: 6, between: 6, shift: 6, tally: 6,
  form: 8, tilt: 6, chain: 6, round: 6, shapeshift: 6, shapetally: 6,
};

/* Countdown ceilings per level, seconds. null = no countdown. */
const FLOOR_10 = [60, 50, 40, 30, 20, 10];
const FLOOR_5 = [60, 49, 38, 27, 16, 5];
const FLOOR_30_X6 = [60, 54, 48, 42, 36, 30];
const FLOOR_30_X8 = [60, 56, 51, 47, 43, 39, 34, 30];

export const COUNTDOWN_TABLE: Record<GameId, number[] | null> = {
  swatch: FLOOR_10,
  mix: [120, 120, 120, 120, 120, 120],
  echo: FLOOR_30_X6,
  between: FLOOR_10,
  shift: null,
  tally: FLOOR_10,
  form: FLOOR_30_X8,
  tilt: FLOOR_5,
  chain: FLOOR_30_X6,
  round: FLOOR_30_X6,
  shapeshift: null,
  shapetally: FLOOR_10,
};

export const countdownFor = (gameId: GameId, level: number): number | null => {
  const table = COUNTDOWN_TABLE[gameId];
  if (!table) return null;
  return table[Math.min(level, table.length) - 1];
};

/* Continuous difficulty: level plus the fraction of the current 5-run
   cycle already cleared, so run 5 of a level plays almost like run 1 of
   the next. Games feed this float into their param getters — continuous
   knobs interpolate, discrete knobs bump near the cycle's end. */
export const difficultyRamp = (p: GameProgress, gameId: GameId): number =>
  Math.min(MAX_LEVEL[gameId], p.level + p.runsInLevel / RUNS_PER_LEVEL);

/* Points cost of one extra life, indexed by current level (1-based).
   25 / 75 / 150 then a roughly 2x ramp; Shape Match's L7-L8 extend it. */
const LIFE_COST = [25, 75, 150, 350, 700, 1000, 1300, 1600];
export const lifeCost = (level: number): number =>
  LIFE_COST[Math.min(level, LIFE_COST.length) - 1];

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const STORE_KEY = "polo-progress-v1";

type ProgressMap = Partial<Record<GameId, GameProgress>>;

export const freshProgress = (): GameProgress => ({
  level: 1,
  lives: START_LIVES,
  streakCurrent: 0,
  streakBest: 0,
  pointsTotal: 0,
  runsInLevel: 0,
  cleanPassesInLevel: 0,
  bestRunScore: 0,
});

const loadAll = (): ProgressMap => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveAll = (map: ProgressMap) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — progress stays session-only */
  }
};

export const getProgress = (gameId: GameId): GameProgress => ({
  ...freshProgress(),
  ...loadAll()[gameId],
});

export const getAllProgress = (): ProgressMap => loadAll();

const putProgress = (gameId: GameId, p: GameProgress) => {
  const map = loadAll();
  map[gameId] = p;
  saveAll(map);
};

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

/* One finished run. `passed` is the streak/level gate (hit, or score>=80);
   `points` is what this run banks (flat score or 100/0). */
export function reportRun(gameId: GameId, passed: boolean, points: number): RunOutcome {
  const p = getProgress(gameId);
  const maxLevel = MAX_LEVEL[gameId];
  let kind: RunOutcome["kind"];
  let livesBefore = p.lives;

  p.bestRunScore = Math.max(p.bestRunScore, Math.max(0, Math.round(points)));

  if (passed) {
    kind = "pass";
    p.streakCurrent += 1;
    p.streakBest = Math.max(p.streakBest, p.streakCurrent);
    p.pointsTotal += Math.max(0, Math.round(points));
    p.cleanPassesInLevel += 1;
    p.runsInLevel += 1;
  } else if (p.lives > 0) {
    kind = "lifeSaved";
    p.lives -= 1;
    /* Score-based games still bank their sub-80 score on a saved miss */
    p.pointsTotal += Math.max(0, Math.round(points));
    p.runsInLevel += 1; /* not a clean pass — cycle can't promote now */
  } else {
    kind = "streakBroken";
    p.streakCurrent = 0;
    p.runsInLevel = 0;
    p.cleanPassesInLevel = 0;
  }

  let leveledUp = false;
  let cycleFailed = false;
  if (p.runsInLevel >= RUNS_PER_LEVEL) {
    if (p.cleanPassesInLevel >= RUNS_PER_LEVEL && p.level < maxLevel) {
      p.level += 1;
      p.lives = Math.min(MAX_LIVES, p.lives + 1);
      leveledUp = true;
    } else if (p.cleanPassesInLevel < RUNS_PER_LEVEL) {
      cycleFailed = true;
    }
    /* At max level a clean cycle still resets and keeps banking points */
    p.runsInLevel = 0;
    p.cleanPassesInLevel = 0;
  }

  putProgress(gameId, p);

  return {
    kind,
    leveledUp,
    cycleFailed,
    newLevel: p.level,
    pointsEarned: kind === "streakBroken" ? 0 : Math.max(0, Math.round(points)),
    livesLeft: p.lives,
    promptBuyLife: p.lives === 1 && livesBefore > 1,
    mastered: leveledUp && p.level >= maxLevel,
  };
}

/* Trade points for one life. Points can't go negative; lives cap at 5. */
export function buyLife(gameId: GameId): boolean {
  const p = getProgress(gameId);
  const cost = lifeCost(p.level);
  if (p.pointsTotal < cost || p.lives >= MAX_LIVES) return false;
  p.pointsTotal -= cost;
  p.lives += 1;
  putProgress(gameId, p);
  return true;
}

/* The fatal-miss rescue: reportRun already committed the streak break;
   buying here restores the pre-break streak and cycle, charges the level's
   life cost, and burns the bought life on the miss that triggered it (the
   run counts like any life-saved miss — no clean pass, cycle can't
   promote). Returns false if points can't cover it. */
export function rescueStreak(
  gameId: GameId,
  snapshot: { streakCurrent: number; runsInLevel: number; cleanPassesInLevel: number },
  runPoints: number
): boolean {
  const p = getProgress(gameId);
  const cost = lifeCost(p.level);
  if (p.pointsTotal < cost) return false;
  p.pointsTotal -= cost;
  p.pointsTotal += Math.max(0, Math.round(runPoints));
  p.streakCurrent = snapshot.streakCurrent;
  p.cleanPassesInLevel = snapshot.cleanPassesInLevel;
  p.runsInLevel = snapshot.runsInLevel + 1;
  if (p.runsInLevel >= RUNS_PER_LEVEL) {
    p.runsInLevel = 0;
    p.cleanPassesInLevel = 0;
  }
  putProgress(gameId, p);
  return true;
}

/* Player-triggered full restart of LIVE state only. The banked leaderboard
   record (pointsTotal, streakBest) survives — it is a permanent record. */
export function resetLiveState(gameId: GameId) {
  const p = getProgress(gameId);
  const fresh = freshProgress();
  fresh.pointsTotal = p.pointsTotal;
  fresh.streakBest = p.streakBest;
  putProgress(gameId, fresh);
}
