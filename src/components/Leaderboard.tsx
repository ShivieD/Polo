/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { GameId } from "../types";
import { GameHead, Btn } from "./ui/Kit";
import { BoardPanel } from "./ui/BoardPanel";
import { getPlayer, setPlayerName, switchUser, leaderboardOnline, submitStats } from "../utils/leaderboard";
import { getProgress } from "../utils/progression";
import { playTick, triggerHaptic } from "../utils/audio";

/*
 * The dashboard — two faces:
 *  · Leaderboard (default): one stacked container per instrument, top 10
 *    by points beside top 10 by best streak, with a checkbox dropdown
 *    controlling which instruments are visible.
 *  · Report Card: one table of the player's own numbers across all 12 —
 *    banked points, best streak, and best single-run score.
 * Strictly per game; there is deliberately no cross-game total.
 */

const GAMES: { id: GameId; name: string }[] = [
  { id: "swatch", name: "Color Match" },
  { id: "mix", name: "Color Mixer" },
  { id: "echo", name: "Repeat the Pattern" },
  { id: "between", name: "Find the Spot" },
  { id: "shift", name: "Spot the Difference" },
  { id: "tally", name: "Count it All" },
  { id: "form", name: "Shape Match" },
  { id: "tilt", name: "Match the Tilt" },
  { id: "chain", name: "Repeat the Chain" },
  { id: "round", name: "Round the Corner" },
  { id: "shapeshift", name: "Spot the Shift" },
  { id: "shapetally", name: "Count the Shapes" },
];

const VISIBLE_KEY = "polo-board-visible-v1";

const loadVisible = (): Record<string, boolean> => {
  try {
    const saved = JSON.parse(localStorage.getItem(VISIBLE_KEY) || "null");
    if (saved && typeof saved === "object") return saved;
  } catch {
    /* fall through */
  }
  return Object.fromEntries(GAMES.map((g) => [g.id, true]));
};

const GameBoard: React.FC<{ id: GameId; name: string; playerName: string | null }> = ({ id, name, playerName }) => (
  <motion.section
    id={`board-${id}`}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 320, damping: 26 }}
    className="border-[1.5px] border-line rounded-3xl p-5 sm:p-6"
  >
    <h3 className="font-display font-extrabold text-[16px] text-ink mb-4">{name}</h3>
    <BoardPanel gameId={id} playerName={playerName} />
  </motion.section>
);

const ReportCard: React.FC = () => {
  const rows = useMemo(
    () =>
      GAMES.map((g) => {
        const p = getProgress(g.id);
        return { ...g, points: p.pointsTotal, bestStreak: p.streakBest, bestRun: p.bestRunScore, level: p.level };
      }),
    []
  );
  return (
    <div className="border-[1.5px] border-line rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-[1.5px] border-line">
              {["Game", "Level", "Points", "Best streak", "Personal best"].map((h, i) => (
                <th
                  key={h}
                  className={`font-mono font-extrabold text-[10.5px] tracking-[0.14em] uppercase text-mut px-4 py-3 whitespace-nowrap ${
                    i > 0 ? "text-right" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} id={`report-row-${r.id}`} className="border-b-[1.5px] border-line last:border-b-0">
                <td className="px-4 py-3 text-[13.5px] font-semibold text-ink whitespace-nowrap">{r.name}</td>
                <td className="px-4 py-3 text-right font-mono font-extrabold text-[12px] text-ink tabular-nums">
                  L{r.level}
                </td>
                <td className="px-4 py-3 text-right font-mono font-extrabold text-[12px] text-ink tabular-nums">
                  {r.points.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono font-extrabold text-[12px] text-ink tabular-nums">
                  {r.bestStreak}
                </td>
                <td className="px-4 py-3 text-right font-mono font-extrabold text-[12px] text-ink tabular-nums">
                  {r.bestRun}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const Leaderboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [tab, setTab] = useState<"board" | "report">("board");
  const [visible, setVisible] = useState<Record<string, boolean>>(loadVisible);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [player, setPlayer] = useState(getPlayer);

  const toggleGame = (id: GameId) => {
    playTick();
    setVisible((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(VISIBLE_KEY, JSON.stringify(next));
      } catch {
        /* session-only */
      }
      return next;
    });
  };

  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  const saveName = () => {
    if (!nameDraft.trim()) return;
    playTick();
    triggerHaptic();
    setPlayerName(nameDraft);
    setPlayer(getPlayer());
    setEditing(false);
    GAMES.forEach(({ id }) => {
      const p = getProgress(id);
      if (p.pointsTotal > 0 || p.streakBest > 0) submitStats(id, p.pointsTotal, p.streakBest);
    });
  };

  const handleNameChangeRequest = () => {
    if (player.name) {
      setConfirmOpen(true);
    } else {
      setEditing(true);
    }
  };

  const confirmNameChange = () => {
    playTick();
    setConfirmOpen(false);
    setNameDraft(player.name || "");
    setEditing(true);
  };

  const handleSwitch = () => {
    playTick();
    triggerHaptic();
    const fresh = switchUser();
    setPlayer(fresh);
    setNameDraft("");
    setEditing(false);
    setSwitchOpen(false);
  };

  const shown = GAMES.filter((g) => visible[g.id]);

  return (
    <div id="leaderboard-container" className="w-full flex flex-col flex-1 max-w-3xl mx-auto">
      <GameHead title="Dashboard" onBack={onBack} />

      <div className="mb-7 border-2 border-ink rounded-3xl p-5">
        {!player.name && !editing ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <p className="text-[14px] text-mut leading-relaxed flex-1">
              <b className="text-ink font-semibold">Pick a display name</b> to appear on the boards.
              No account — the name sticks to this device.
            </p>
            <span className="flex items-center gap-3">
              <input
                id="leaderboard-name-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                maxLength={24}
                placeholder="Your name"
                className="border-2 border-ink rounded-full px-4 py-2 bg-paper text-ink text-[14px] font-semibold w-40 focus:outline-none"
              />
              <Btn id="leaderboard-name-save" variant="secondary" className="!px-5 !py-2" onClick={saveName}>
                Save
              </Btn>
            </span>
          </div>
        ) : editing ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <p className="text-[14px] text-mut leading-relaxed flex-1">
              <b className="text-ink font-semibold">Change your name.</b> Your scores stay, but the old
              name disappears from boards on this device.
            </p>
            <span className="flex items-center gap-3">
              <input
                id="leaderboard-name-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditing(false);
                }}
                maxLength={24}
                autoFocus
                placeholder="New name"
                className="border-2 border-ink rounded-full px-4 py-2 bg-paper text-ink text-[14px] font-semibold w-40 focus:outline-none"
              />
              <Btn id="leaderboard-name-save" variant="secondary" className="!px-5 !py-2" onClick={saveName}>
                Save
              </Btn>
              <button
                onClick={() => setEditing(false)}
                className="font-mono font-extrabold text-[10px] tracking-[0.12em] uppercase text-mut underline underline-offset-4 decoration-1 hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-display font-extrabold text-lg text-ink">{player.name}</span>
            <button
              id="edit-name-btn"
              onClick={handleNameChangeRequest}
              aria-label="Change name"
              className="w-8 h-8 rounded-full border-[1.5px] border-line flex items-center justify-center text-mut hover:text-ink hover:border-ink cursor-pointer transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
            <span className="text-line select-none">|</span>
            <button
              id="switch-user-btn"
              onClick={() => setSwitchOpen(true)}
              className="font-mono font-extrabold text-[10px] tracking-[0.12em] uppercase text-mut underline underline-offset-4 decoration-1 hover:text-ink cursor-pointer"
            >
              Switch user
            </button>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: "color-mix(in srgb, var(--color-ink-fixed) 55%, transparent)" }}>
          <motion.div
            initial={{ scale: 0.85, y: 18 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className="bg-paper border-2 border-ink rounded-3xl px-7 py-8 max-w-sm w-full flex flex-col items-center text-center gap-5"
          >
            <div>
              <div className="font-display font-extrabold text-xl text-ink mb-1.5">Change your name?</div>
              <p className="text-[14px] text-mut leading-relaxed">
                Without an account, your old name can't be linked to your scores anymore.
                Your <b className="text-ink">points and streaks stay</b>, but anyone looking at the
                boards won't know the old name was you.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <Btn variant="secondary" onClick={() => setConfirmOpen(false)}>
                Keep current name
              </Btn>
              <Btn variant="secondary" onClick={confirmNameChange}>
                Change anyway
              </Btn>
            </div>
          </motion.div>
        </div>
      )}

      {switchOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: "color-mix(in srgb, var(--color-ink-fixed) 55%, transparent)" }}>
          <motion.div
            initial={{ scale: 0.85, y: 18 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className="bg-paper border-2 border-ink rounded-3xl px-7 py-8 max-w-sm w-full flex flex-col items-center text-center gap-5"
          >
            <div>
              <div className="font-display font-extrabold text-xl text-ink mb-1.5">Switch to a new player?</div>
              <p className="text-[14px] text-mut leading-relaxed">
                This creates a fresh identity — <b className="text-ink">all progress, points, and streaks
                on this device will be cleared</b>. The old player's leaderboard entries stay, but you
                can't switch back without an account.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <Btn variant="secondary" onClick={() => setSwitchOpen(false)}>
                Stay as {player.name}
              </Btn>
              <Btn variant="secondary" onClick={handleSwitch}>
                New player
              </Btn>
            </div>
          </motion.div>
        </div>
      )}

      {/* Tabs + visibility dropdown */}
      <div className="flex items-center gap-3 mb-7 relative">
        <div className="inline-flex border-2 border-ink rounded-full p-1 bg-paper" role="tablist" aria-label="Dashboard view">
          {([
            { id: "board", label: "Leaderboard" },
            { id: "report", label: "Report card" },
          ] as const).map((t) => (
            <button
              key={t.id}
              id={`dashboard-tab-${t.id}`}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                playTick();
                setTab(t.id);
              }}
              className={`px-4 sm:px-5 py-1.5 rounded-full font-mono font-extrabold text-[10.5px] tracking-[0.12em] uppercase cursor-pointer transition-colors ${
                tab === t.id ? "bg-ink text-paper" : "text-ink hover:bg-wash"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "board" && (
          <div className="ml-auto relative">
            <button
              id="board-visibility-btn"
              onClick={() => {
                playTick();
                setPickerOpen((o) => !o);
              }}
              aria-expanded={pickerOpen}
              className="font-mono font-extrabold text-[10.5px] tracking-[0.12em] uppercase border-[1.5px] border-line rounded-full px-3.5 py-1.5 text-ink hover:border-ink cursor-pointer"
            >
              Games · {shown.length}/12 ▾
            </button>
            {pickerOpen && (
              <div
                id="board-visibility-menu"
                className="absolute right-0 top-full mt-2 z-40 bg-paper border-2 border-ink rounded-2xl p-3 w-56 shadow-[0_6px_0_var(--color-ink)]"
              >
                {GAMES.map((g) => (
                  <label
                    key={g.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-wash cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={!!visible[g.id]}
                      onChange={() => toggleGame(g.id)}
                      className="w-4 h-4 accent-current"
                    />
                    <span className="text-[13px] font-semibold text-ink">{g.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {tab === "board" ? (
        <div className="flex flex-col gap-5 pb-8">
          {shown.length === 0 && (
            <p className="text-[14px] text-mut py-8 text-center">All boards hidden — pick some games above.</p>
          )}
          {shown.map((g) => (
            <GameBoard key={g.id} id={g.id} name={g.name} playerName={player.name} />
          ))}
        </div>
      ) : (
        <div className="pb-8">
          <ReportCard />
        </div>
      )}

      {!leaderboardOnline() && (
        <p className="pb-8 font-mono font-medium text-[10px] tracking-[0.14em] uppercase text-mut">
          Offline board — showing this device only. Connect Supabase env keys to go global.
        </p>
      )}
    </div>
  );
};

export default Leaderboard;
