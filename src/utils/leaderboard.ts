/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameId } from "../types";
import { demoField } from "./demoPlayers";

/*
 * Leaderboard client — anonymous, per-game, no auth.
 *
 * Identity is a client-generated UUID kept in localStorage plus a typed
 * display name; the same name on another device is a separate row.
 *
 * Backend is Supabase (URL + anon key via Vite env vars). All writes go
 * through the `submit_score` Postgres RPC (see supabase/schema.sql) which
 * clamps values server-side; reads hit the table directly. When the env
 * vars are absent the module degrades to local-only mode: the board shows
 * just your own device's row, and everything else keeps working.
 */

const URL_KEY = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const leaderboardOnline = (): boolean => Boolean(URL_KEY && ANON_KEY);

/* ------------------------------------------------------------------ */
/* Player identity                                                     */
/* ------------------------------------------------------------------ */

const PLAYER_KEY = "polo-player-v1";

export interface Player {
  id: string;
  name: string | null;
}

export const getPlayer = (): Player => {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_KEY) || "null");
    if (saved?.id) return saved;
  } catch {
    /* fall through */
  }
  const fresh: Player = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `p-${Math.random().toString(36).slice(2)}`,
    name: null,
  };
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(fresh));
  } catch {
    /* session-only identity */
  }
  return fresh;
};

export const setPlayerName = (name: string) => {
  const p = getPlayer();
  p.name = name.trim().slice(0, 24);
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
};

export const switchUser = () => {
  try {
    localStorage.removeItem(PLAYER_KEY);
    localStorage.removeItem("polo-progress-v1");
    localStorage.removeItem("polo-board-visible-v1");
  } catch {
    /* ignore */
  }
  return getPlayer();
};

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

export interface BoardRow {
  name: string;
  points_total: number;
  streak_best: number;
  isYou?: boolean;
}

const headers = () => ({
  "Content-Type": "application/json",
  apikey: ANON_KEY!,
  Authorization: `Bearer ${ANON_KEY}`,
});

/* Push the current banked record for one game. Fire-and-forget safe. */
export async function submitStats(gameId: GameId, pointsTotal: number, streakBest: number): Promise<void> {
  const player = getPlayer();
  if (!player.name || !leaderboardOnline()) return;
  try {
    await fetch(`${URL_KEY}/rest/v1/rpc/submit_score`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        p_player_id: player.id,
        p_name: player.name,
        p_game_id: gameId,
        p_points_total: Math.max(0, Math.round(pointsTotal)),
        p_streak_best: Math.max(0, Math.round(streakBest)),
      }),
    });
  } catch {
    /* offline — the next submit carries the full totals anyway */
  }
}

export interface Board {
  topPoints: BoardRow[];
  topStreaks: BoardRow[];
  /* Every player's points, for the distribution curve — not just the top 10 */
  population: number[];
  online: boolean;
  /* The reader's own row plus where it actually ranks. A board that only
     ever shows the top 10 hides you the moment you are 11th, which is
     exactly when you most want to know where you stand. */
  you: BoardRow | null;
  youPointsRank: number | null;
  youStreakRank: number | null;
}

/* Offline board: the reader's row dropped into the synthetic field, then
   ranked exactly as the real board would rank it. */
function localBoard(gameId: GameId, you: BoardRow | null): Board {
  const field: BoardRow[] = demoField(gameId).map((d) => ({
    name: d.name,
    points_total: d.points_total,
    streak_best: d.streak_best,
  }));
  const all = you ? [...field, { ...you, isYou: true }] : field;
  const byPoints = [...all].sort((a, b) => b.points_total - a.points_total);
  const byStreak = [...all].sort((a, b) => b.streak_best - a.streak_best);
  return {
    topPoints: byPoints.slice(0, 10),
    topStreaks: byStreak.slice(0, 10),
    population: field.map((f) => f.points_total),
    online: false,
    you: you ? { ...you, isYou: true } : null,
    youPointsRank: you ? byPoints.findIndex((r) => r.isYou) + 1 : null,
    youStreakRank: you ? byStreak.findIndex((r) => r.isYou) + 1 : null,
  };
}

export async function fetchBoard(gameId: GameId, localFallback: BoardRow | null): Promise<Board> {
  if (!leaderboardOnline()) {
    return localBoard(gameId, localFallback);
  }
  try {
    const me = getPlayer();
    const query = (order: string) =>
      fetch(
        `${URL_KEY}/rest/v1/game_stats?game_id=eq.${gameId}&select=name:players(name),points_total,streak_best,player_id&order=${order}&limit=10`,
        { headers: headers() }
      ).then((r) => r.json());
    const [byPoints, byStreak, sample] = await Promise.all([
      query("points_total.desc"),
      query("streak_best.desc"),
      /* A wide sample for the curve — the top 10 alone would make every
         player look like they were scraping the bottom of the field */
      fetch(
        `${URL_KEY}/rest/v1/game_stats?game_id=eq.${gameId}&select=points_total&order=points_total.desc&limit=500`,
        { headers: headers() }
      ).then((r) => r.json()),
    ]);
    const shape = (rows: unknown): BoardRow[] =>
      (Array.isArray(rows) ? rows : []).map((r) => {
        const row = r as { name?: { name?: string }; points_total?: number; streak_best?: number; player_id?: string };
        return {
          name: row.name?.name ?? "Anonymous",
          points_total: row.points_total ?? 0,
          streak_best: row.streak_best ?? 0,
          isYou: row.player_id === me.id,
        };
      });
    const population = (Array.isArray(sample) ? sample : [])
      .map((r) => (r as { points_total?: number }).points_total ?? 0);
    /* Rank read off the wide points sample; the streak board has no such
       sample, so its rank stays unknown rather than guessed */
    const youRow = localFallback ? { ...localFallback, isYou: true } : null;
    const youPointsRank = youRow
      ? population.filter((p) => p > youRow.points_total).length + 1
      : null;
    return {
      topPoints: shape(byPoints),
      topStreaks: shape(byStreak),
      population,
      online: true,
      you: youRow,
      youPointsRank,
      youStreakRank: null,
    };
  } catch {
    return localBoard(gameId, localFallback);
  }
}
