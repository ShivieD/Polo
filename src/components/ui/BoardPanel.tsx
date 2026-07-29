/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { GameId } from "../../types";
import { ScoreCurve } from "./ScoreCurve";
import { fetchBoard, getPlayer, Board } from "../../utils/leaderboard";
import { getProgress } from "../../utils/progression";

/*
 * One instrument's board: where the field sits, and where you sit in it.
 *
 * Deliberately self-contained (no Kit import) — Kit renders this inside the
 * in-game overlay, so importing Kit back would close a cycle.
 */

interface Row {
  name: string;
  value: number;
  isYou?: boolean;
  rank: number;
}

const RowItem: React.FC<{ r: Row; unit: string; detached?: boolean }> = ({ r, unit, detached }) => (
  <li
    className={`flex items-center gap-2.5 rounded-xl px-3 py-1.5 border-[1.5px] ${
      r.isYou ? "border-ink bg-wash" : "border-line"
    } ${detached ? "mt-2" : ""}`}
  >
    <span className="font-mono font-extrabold text-[10.5px] text-mut tabular-nums w-6">
      {r.rank > 99 ? "99+" : String(r.rank).padStart(2, "0")}
    </span>
    <span className="text-[13.5px] font-semibold text-ink truncate flex-1">
      {r.name}
      {r.isYou && <span className="text-mut font-normal"> · you</span>}
    </span>
    <span className="font-mono font-extrabold text-[11.5px] text-ink tabular-nums whitespace-nowrap">
      {r.value.toLocaleString()} {unit}
    </span>
  </li>
);

/* The top ten, plus — when the reader is not in it — their own row pinned
   below a divider at its true rank. */
const Rows: React.FC<{ rows: Row[]; unit: string; you?: Row | null }> = ({ rows, unit, you }) => {
  const top = rows.slice(0, 10);
  const youInTop = top.some((r) => r.isYou);
  return (
    <ol className="flex flex-col gap-1.5">
      {top.length === 0 && <li className="text-[13px] text-mut py-2">No entries yet.</li>}
      {top.map((r, i) => (
        <RowItem key={i} r={r} unit={unit} />
      ))}
      {!youInTop && you && (
        <>
          <li aria-hidden="true" className="font-mono font-extrabold text-[10px] text-mut text-center leading-none pt-1">
            · · ·
          </li>
          <RowItem r={you} unit={unit} detached />
        </>
      )}
    </ol>
  );
};

const Spinner: React.FC = () => (
  <div className="flex justify-center py-8">
    <span className="w-6 h-6 rounded-full border-2 border-line border-t-ink animate-spin" />
  </div>
);

export const BoardPanel: React.FC<{
  gameId: GameId;
  /* Re-fetch when the reader names themselves — the board must show the
     new name at once, not on the next visit */
  playerName?: string | null;
  accent?: string;
  showCurve?: boolean;
}> = ({ gameId, playerName, accent, showCurve = true }) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [you, setYou] = useState(() => getProgress(gameId));

  useEffect(() => {
    const local = getProgress(gameId);
    setYou(local);
    const player = getPlayer();
    let live = true;
    setBoard(null);
    fetchBoard(gameId, {
      name: player.name ?? "You (unnamed)",
      points_total: local.pointsTotal,
      streak_best: local.streakBest,
    }).then((b) => live && setBoard(b));
    return () => {
      live = false;
    };
  }, [gameId, playerName]);

  if (!board) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      {showCurve && (
        <div>
          <h4 className="font-mono font-extrabold text-[10.5px] tracking-[0.16em] uppercase text-mut mb-2">
            Where you stand
          </h4>
          <ScoreCurve
            id={`curve-${gameId}`}
            population={board.population}
            you={you.pointsTotal}
            accent={accent}
          />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <h4 className="font-mono font-extrabold text-[10.5px] tracking-[0.16em] uppercase text-mut mb-2.5">
            Top points
          </h4>
          <Rows
            unit="pts"
            rows={board.topPoints.map((r, i) => ({ name: r.name, value: r.points_total, isYou: r.isYou, rank: i + 1 }))}
            you={
              board.you && board.youPointsRank
                ? { name: board.you.name, value: board.you.points_total, isYou: true, rank: board.youPointsRank }
                : null
            }
          />
        </div>
        <div>
          <h4 className="font-mono font-extrabold text-[10.5px] tracking-[0.16em] uppercase text-mut mb-2.5">
            Best streaks
          </h4>
          <Rows
            unit="run"
            rows={board.topStreaks.map((r, i) => ({ name: r.name, value: r.streak_best, isYou: r.isYou, rank: i + 1 }))}
            you={
              board.you && board.youStreakRank
                ? { name: board.you.name, value: board.you.streak_best, isYou: true, rank: board.youStreakRank }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
};

/* The in-game overlay the header pill opens */
export const BoardOverlay: React.FC<{
  gameId: GameId;
  title: string;
  accent?: string;
  onClose: () => void;
}> = ({ gameId, title, accent, onClose }) => (
  <div
    id="game-board-overlay"
    className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto"
    /* ink-FIXED, not ink: --color-ink flips to near-white in dark mode, which
       would paint this scrim white over a dark page */
    style={{ background: "color-mix(in srgb, var(--color-ink-fixed) 55%, transparent)" }}
    onClick={onClose}
    role="dialog"
    aria-modal="true"
    aria-label={`${title} leaderboard`}
  >
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      onClick={(e) => e.stopPropagation()}
      className="bg-paper border-2 border-ink rounded-3xl p-5 sm:p-7 w-full max-w-2xl my-auto"
    >
      <div className="flex items-center gap-4 mb-5">
        <h3 className="font-display font-extrabold text-[18px] sm:text-xl text-ink">{title}</h3>
        <button
          onClick={onClose}
          aria-label="Close leaderboard"
          className="ml-auto w-9 h-9 rounded-full border-2 border-ink text-ink flex items-center justify-center cursor-pointer hover:bg-wash shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <BoardPanel gameId={gameId} accent={accent} />
    </motion.div>
  </div>
);

export default BoardPanel;
