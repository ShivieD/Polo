/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameId } from "../types";
import { BoardRow } from "./leaderboard";

/*
 * Demo population — the boards would read as an empty room until enough
 * real players arrive, and an empty room hides the whole point of a
 * leaderboard (where do I actually stand?). So when the backend is not
 * connected, the board is filled with a synthetic field of players.
 *
 * The field is DETERMINISTIC: a seeded PRNG keyed on the game id, so the
 * same instrument always shows the same rivals across reloads, and no two
 * instruments show the same numbers. It is also the population the score
 * distribution curve is drawn from, so the curve and the top-10 always
 * agree with each other.
 */

/* mulberry32 — small, fast, good enough for a fake crowd */
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const NAMES = [
  "Aarav", "Mira", "Devon", "Ines", "Kofi", "Lena", "Tomas", "Priya",
  "Noor", "Hugo", "Sana", "Emeka", "Yuki", "Rafa", "Anja", "Kian",
  "Zara", "Otto", "Nadia", "Bruno", "Leila", "Mateo", "Freya", "Idris",
  "Rhea", "Casper", "Wren", "Nikhil", "Solveig", "Tariq", "Juno", "Amara",
  "Bo", "Elif", "Marek", "Simone", "Kaito", "Vera", "Oscar", "Neha",
];

/* Two-thirds of a plausible field sit mid-pack, a few run away with it —
   a right-skewed spread reads more like real play than a flat random one */
const skewed = (r: () => number): number => {
  const u = (r() + r() + r()) / 3; // central-limit bump toward the middle
  return Math.pow(u, 1.7); // then stretched, so the tail is thin
};

export interface DemoRow extends BoardRow {
  playerId: string;
}

/* One synthetic field for one instrument. Points scale is tuned to the
   flat 100-per-clean-run economy: a committed player banks a few thousand. */
export function demoField(gameId: GameId, size = 34): DemoRow[] {
  const r = rng(hash(gameId));
  const picked = [...NAMES].sort(() => r() - 0.5).slice(0, size);
  return picked.map((name, i) => {
    const s = skewed(r);
    const points = Math.round(120 + s * 5400);
    /* Streaks correlate with points but noisily — the streak board is
       deliberately a different ranking, not a re-sort of the same one */
    const streak = Math.max(1, Math.round(s * 46 * (0.55 + r() * 0.9)));
    return {
      playerId: `demo-${gameId}-${i}`,
      name,
      points_total: points,
      streak_best: streak,
    };
  });
}

/* Every demo player's points for one game — the sample the bell curve and
   the percentile read are computed from. */
export const demoPoints = (gameId: GameId): number[] =>
  demoField(gameId).map((d) => d.points_total);
