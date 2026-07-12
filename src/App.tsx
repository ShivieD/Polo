/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { GameId } from "./types";
import { toggleSound, playTick, triggerHaptic } from "./utils/audio";
import { PoloMark, SwatchGlyph, MixGlyph, EchoGlyph, BetweenGlyph, ShiftGlyph, TallyGlyph } from "./components/ui/Glyphs";
import { Streak } from "./components/ui/Kit";

import { SwatchGame } from "./components/games/SwatchGame";
import { MixGame } from "./components/games/MixGame";
import { EchoGame } from "./components/games/EchoGame";
import { BetweenGame } from "./components/games/BetweenGame";
import { ShiftGame } from "./components/games/ShiftGame";
import { TallyGame } from "./components/games/TallyGame";

/* three.js is loaded lazily so the game itself never waits on it */
const AmbientBlocks = lazy(() => import("./components/AmbientBlocks"));

const gamesList = [
  {
    id: "swatch" as GameId,
    name: "Color Match",
    oneLiner: "Spot the exact color among near-identical impostors.",
    accent: "#ff4b3e",
    glyph: <SwatchGlyph />,
  },
  {
    id: "mix" as GameId,
    name: "Color Mixer",
    oneLiner: "Blend the dials until your mix melts into the target.",
    accent: "#2d6cf6",
    glyph: <MixGlyph />,
  },
  {
    id: "echo" as GameId,
    name: "Repeat the Pattern",
    oneLiner: "Watch the pads fire, then answer in exact order.",
    accent: "#ffc400",
    glyph: <EchoGlyph />,
  },
  {
    id: "between" as GameId,
    name: "Find the Spot",
    oneLiner: "Pin the color to its exact home on the gradient.",
    accent: "#1fbf66",
    glyph: <BetweenGlyph />,
  },
  {
    id: "shift" as GameId,
    name: "Spot the Difference",
    oneLiner: "One block drifted off-color. Find it.",
    accent: "#2d6cf6",
    glyph: <ShiftGlyph />,
  },
  {
    id: "tally" as GameId,
    name: "Count it all",
    oneLiner: "Count the pieces before they vanish — dots first, then shapes.",
    accent: "#ff4b3e",
    glyph: <TallyGlyph />,
  },
];

interface Flood {
  rect: { left: number; top: number; width: number; height: number };
  color: string;
  id: GameId;
  phase: "expand" | "fade";
}

type StreakMap = Partial<Record<GameId, number>>;

const STREAKS_KEY = "polo-streaks";
const PLAYED_KEY = "polo-played";

const loadStreaks = (): StreakMap => {
  try {
    return JSON.parse(localStorage.getItem(STREAKS_KEY) || "{}");
  } catch {
    return {};
  }
};

/* Which instruments the player has completed at least one round of. Persisted
   so the "instruments done" tally survives a reload (played once = done). */
const loadPlayed = (): Set<GameId> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(PLAYED_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

export default function App() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [played, setPlayed] = useState<Set<GameId>>(loadPlayed);
  const [streaks, setStreaks] = useState<StreakMap>(loadStreaks);
  const [flood, setFlood] = useState<Flood | null>(null);

  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundOn(next);
    if (next) {
      setTimeout(() => {
        playTick();
        triggerHaptic();
      }, 50);
    }
  };

  /* The Chroma transition: the tile's color floods outward into the game
     screen — one continuous move, no cut. */
  const handleSelectGame = (id: GameId, e: React.MouseEvent<HTMLButtonElement>) => {
    if (flood) return;
    playTick();
    triggerHaptic();
    const r = e.currentTarget.getBoundingClientRect();
    const accent = gamesList.find((g) => g.id === id)!.accent;
    setFlood({
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      color: accent,
      id,
      phase: "expand",
    });
  };

  const handleBackToHome = () => {
    setActiveGame(null);
  };

  /* Games report each round: correct answers grow that game's streak,
     a miss resets it, and either way the game is marked played. Both survive
     reloads via localStorage. */
  const reportResult = (id: GameId, correct: boolean) => {
    setPlayed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(PLAYED_KEY, JSON.stringify([...next]));
      } catch {
        /* storage unavailable — played set stays session-only */
      }
      return next;
    });
    setStreaks((prev) => {
      const next = { ...prev, [id]: correct ? (prev[id] ?? 0) + 1 : 0 };
      try {
        localStorage.setItem(STREAKS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — streaks stay session-only */
      }
      return next;
    });
  };

  const gameProps = (id: GameId) => ({
    accentColor: gamesList.find((g) => g.id === id)!.accent,
    onBack: handleBackToHome,
    onResult: (correct: boolean) => reportResult(id, correct),
    streak: streaks[id] ?? 0,
  });

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-paper text-ink flex flex-col font-sans antialiased">
        <div className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-8 flex flex-col">

          {/* Top bar — wordmark, session streak, sound */}
          <header className="flex items-center gap-3.5 pt-7 pb-5 border-b-[1.5px] border-line select-none">
            <PoloMark />
            <span className="font-display font-extrabold text-[17px] tracking-[0.02em]">POLO</span>
            <div className="ml-auto flex items-center gap-5">
              {!activeGame && <Streak total={gamesList.length} done={played.size} className="hidden sm:flex" />}
              <button
                id="sound-toggle-btn"
                onClick={handleToggleSound}
                className="btn-press bg-paper px-4 py-2 font-mono font-extrabold text-[10.5px] tracking-[0.14em] uppercase flex items-center gap-2 cursor-pointer"
                aria-pressed={soundOn}
              >
                <i className={`w-2 h-2 rounded-full ${soundOn ? "bg-play-green" : "bg-line"}`} />
                {soundOn ? "Sound on" : "Sound off"}
              </button>
            </div>
          </header>

          <main className="flex-1 flex flex-col py-8">
            {!activeGame ? (
              <div className="flex flex-col flex-1">
                {/* Head with the quiet 3D moment behind it */}
                <div className="relative mb-9 min-h-[128px] flex flex-col justify-center">
                  <Suspense fallback={null}>
                    <AmbientBlocks />
                  </Suspense>
                  <h1 className="relative font-display font-extrabold text-3xl sm:text-5xl tracking-tight text-ink mb-3">
                    Train your eye.
                  </h1>
                  <span className="relative font-mono font-medium text-[12px] tracking-[0.2em] uppercase text-mut tabular-nums">
                    Daily drill · <b className="text-ink font-extrabold">{played.size} of {gamesList.length}</b> instruments done
                  </span>
                </div>

                {/* Game tiles — they land, they don't appear */}
                <div id="games-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gamesList.map((game, i) => (
                    <motion.button
                      key={game.id}
                      id={`game-tile-${game.id}`}
                      onClick={(e) => handleSelectGame(game.id, e)}
                      initial={{ opacity: 0, y: 26, rotate: -1.5 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      transition={{ delay: 0.05 + i * 0.06, type: "spring", stiffness: 320, damping: 21 }}
                      className="tile-press bg-paper border-[1.5px] border-line rounded-3xl p-6 pb-5 text-left cursor-pointer flex flex-col"
                    >
                      <span className="tile-glyph h-[52px] flex items-center mb-4">{game.glyph}</span>
                      <span className="font-display font-medium text-[16px] text-ink mb-1.5">{game.name}</span>
                      <span className="text-[14px] text-mut leading-relaxed mb-5">{game.oneLiner}</span>
                      <span className="mt-auto flex items-center justify-between">
                        {(streaks[game.id] ?? 0) > 0 ? (
                          <span className="font-mono font-extrabold text-[10.5px] tracking-[0.14em] uppercase text-ink bg-play-yellow rounded-full px-2.5 py-1 tabular-nums">
                            Streak {streaks[game.id]}
                          </span>
                        ) : (
                          <span className="font-mono font-medium text-[11px] tracking-[0.14em] uppercase text-mut">
                            Ready
                          </span>
                        )}
                        <span className="font-mono font-extrabold text-[11px] tracking-[0.08em] uppercase text-ink inline-flex items-center gap-1.5">
                          Play
                          <svg width="13" height="12" viewBox="0 0 14 12" aria-hidden="true">
                            <path d="M1.5 6h10.5M7.6 1.6 12 6l-4.4 4.4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {activeGame === "swatch" && <SwatchGame {...gameProps("swatch")} />}
                {activeGame === "mix" && <MixGame {...gameProps("mix")} />}
                {activeGame === "echo" && <EchoGame {...gameProps("echo")} />}
                {activeGame === "between" && <BetweenGame {...gameProps("between")} />}
                {activeGame === "shift" && <ShiftGame {...gameProps("shift")} />}
                {activeGame === "tally" && <TallyGame {...gameProps("tally")} />}
              </div>
            )}
          </main>

          <footer className="py-6 border-t-[1.5px] border-line flex items-center justify-between font-mono font-medium text-[10px] tracking-[0.18em] uppercase text-mut select-none">
            <span>Polo · Sensory training</span>
            <span className="flex items-center gap-2">
              <i className="w-2 h-2 rounded-full bg-play-green" />
              Eyes on
            </span>
          </footer>
        </div>

        {/* Color-flood transition overlay */}
        {flood && (
          <motion.div
            className="fixed z-50 pointer-events-none"
            style={{ background: flood.color }}
            initial={{
              left: flood.rect.left,
              top: flood.rect.top,
              width: flood.rect.width,
              height: flood.rect.height,
              borderRadius: 24,
              opacity: 1,
            }}
            animate={
              flood.phase === "expand"
                ? { left: 0, top: 0, width: "100vw", height: "100vh", borderRadius: 0, opacity: 1 }
                : { left: 0, top: 0, width: "100vw", height: "100vh", borderRadius: 0, opacity: 0 }
            }
            transition={
              flood.phase === "expand"
                ? { duration: 0.44, ease: [0.32, 0.72, 0, 1] }
                : { duration: 0.34, ease: "easeOut" }
            }
            onAnimationComplete={() => {
              if (flood.phase === "expand") {
                setActiveGame(flood.id);
                setFlood({ ...flood, phase: "fade" });
              } else {
                setFlood(null);
              }
            }}
          />
        )}
      </div>
    </MotionConfig>
  );
}
