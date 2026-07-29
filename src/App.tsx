/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { Analytics } from "@vercel/analytics/react";
import { GameId, PlayMode, ShapeGameId } from "./types";
import { toggleSound, playTick, triggerHaptic } from "./utils/audio";
import { PoloMark, SwatchGlyph, MixGlyph, EchoGlyph, BetweenGlyph, ShiftGlyph, TallyGlyph } from "./components/ui/Glyphs";
import {
  FormGlyph,
  TiltGlyph,
  ChainGlyph,
  SquircleGlyph,
  ShapeShiftGlyph,
  ShapeTallyGlyph,
} from "./components/ui/ShapeGlyphs";

import { SwatchGame } from "./components/games/SwatchGame";
import { MixGame } from "./components/games/MixGame";
import { EchoGame } from "./components/games/EchoGame";
import { BetweenGame } from "./components/games/BetweenGame";
import { ShiftGame } from "./components/games/ShiftGame";
import { TallyGame } from "./components/games/TallyGame";
import { FormGame } from "./components/games/FormGame";
import { TiltGame } from "./components/games/TiltGame";
import { ChainGame } from "./components/games/ChainGame";
import { SquircleGame } from "./components/games/SquircleGame";
import { ShapeShiftGame } from "./components/games/ShapeShiftGame";
import { ShapeTallyGame } from "./components/games/ShapeTallyGame";
import { Spectrum } from "./components/Spectrum";
import { Leaderboard } from "./components/Leaderboard";
import { getAllProgress } from "./utils/progression";
import { RockerSwitch } from "./components/ui/RockerSwitch";
import { IconWipe } from "./components/ui/IconWipe";

interface Tile {
  id: GameId;
  name: string;
  oneLiner: string;
  glyph: React.ReactNode;
  /* Color tiles flood the screen with their accent on select… */
  accent?: string;
  /* …Shapes tiles wipe it with their own B&W animated pattern instead */
  pattern?: ShapeGameId;
}

const gamesList: Tile[] = [
  {
    id: "swatch",
    name: "Color Match",
    oneLiner: "Spot the exact color among near-identical impostors.",
    accent: "#ff4b3e",
    glyph: <SwatchGlyph />,
  },
  {
    id: "mix",
    name: "Color Mixer",
    oneLiner: "Blend the dials until your mix melts into the target.",
    accent: "#2d6cf6",
    glyph: <MixGlyph />,
  },
  {
    id: "echo",
    name: "Repeat the Pattern",
    oneLiner: "Watch the pads fire, then answer in exact order.",
    accent: "#ffc400",
    glyph: <EchoGlyph />,
  },
  {
    id: "between",
    name: "Find the Spot",
    oneLiner: "Pin the color to its exact home on the gradient.",
    accent: "#1fbf66",
    glyph: <BetweenGlyph />,
  },
  {
    id: "shift",
    name: "Spot the Difference",
    oneLiner: "One block drifted off-color. Find it.",
    accent: "#2d6cf6",
    glyph: <ShiftGlyph />,
  },
  {
    id: "tally",
    name: "Count it All",
    oneLiner: "Count the pieces before they vanish — dots first, then shapes.",
    accent: "#ff4b3e",
    glyph: <TallyGlyph />,
  },
];

/* The Shapes set — six parallel instruments anchored on form, not color.
   Everything inside them is purely greyscale. */
const shapesList: Tile[] = [
  {
    id: "form",
    name: "Shape Match",
    oneLiner: "Spot the exact shape among near-identical impostors.",
    pattern: "form",
    glyph: <FormGlyph />,
  },
  {
    id: "tilt",
    name: "Match the Tilt",
    oneLiner: "Memorize an angle, then set the line back to it.",
    pattern: "tilt",
    glyph: <TiltGlyph />,
  },
  {
    id: "chain",
    name: "Repeat the Chain",
    oneLiner: "Watch shapes land in order, then rebuild the chain.",
    pattern: "chain",
    glyph: <ChainGlyph />,
  },
  {
    id: "round",
    name: "Round the Corner",
    oneLiner: "Match the corner curve from memory.",
    pattern: "round",
    glyph: <SquircleGlyph />,
  },
  {
    id: "shapeshift",
    name: "Spot the Shift",
    oneLiner: "One shape came back changed. Find it.",
    pattern: "shapeshift",
    glyph: <ShapeShiftGlyph />,
  },
  {
    id: "shapetally",
    name: "Count the Shapes",
    oneLiner: "Count the pieces before they vanish — no color to help.",
    pattern: "shapetally",
    glyph: <ShapeTallyGlyph />,
  },
];

interface Flood {
  rect: { left: number; top: number; width: number; height: number };
  /* Exactly one of these is set: color mode floods a hue, shapes mode
     wipes a B&W pattern */
  color?: string;
  pattern?: ShapeGameId;
  id: GameId;
  phase: "expand" | "fade";
}

/* Dark mode darkens a color tile's accent before it floods the screen —
   the tile's full-saturation hue at full brightness is a harsh flash
   against a dark canvas; mixing it 60% toward black keeps the same hue
   identity while landing at a brightness that belongs next to #0f0f0f. */
const darkenForFlood = (hex: string, amount = 0.6): string => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
};

type StreakMap = Partial<Record<GameId, number>>;

const STREAKS_KEY = "polo-streaks";
const PLAYED_KEY = "polo-played";
const THEME_KEY = "polo-theme";

type Theme = "light" | "dark";

/* Saved choice wins; otherwise the app always opens in light mode,
   regardless of OS preference. */
const loadTheme = (): Theme => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* storage unavailable */
  }
  return "light";
};

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
  /* One screen variable: a game, the Spectrum self-check, or home (null) */
  const [screen, setScreen] = useState<GameId | "spectrum" | "leaderboard" | null>(null);
  /* Which tile set is showing. Deliberately not persisted — every fresh
     load opens in Color mode. */
  const [mode, setMode] = useState<PlayMode>("color");
  const [soundOn, setSoundOn] = useState(true);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [played, setPlayed] = useState<Set<GameId>>(loadPlayed);
  const [streaks, setStreaks] = useState<StreakMap>(loadStreaks);
  const [flood, setFlood] = useState<Flood | null>(null);

  /* The toggle stamps the choice on <html>, where the token overrides live */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable — theme stays session-only */
    }
  }, [theme]);

  const handleToggleTheme = () => {
    playTick();
    triggerHaptic();
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  const currentList = mode === "color" ? gamesList : shapesList;
  const doneCount = currentList.filter((g) => played.has(g.id)).length;

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

  const handleSetMode = (next: PlayMode) => {
    if (next === mode || flood) return;
    playTick();
    triggerHaptic();
    setMode(next);
  };

  /* The Chroma transition: a color tile's accent floods outward into the
     game screen; a Shapes tile wipes it with that game's own B&W pattern —
     same geometry, one continuous move, no cut. */
  const handleSelectGame = (tile: Tile, e: React.MouseEvent<HTMLButtonElement>) => {
    if (flood) return;
    playTick();
    triggerHaptic();
    const r = e.currentTarget.getBoundingClientRect();
    setFlood({
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      color: tile.accent && theme === "dark" ? darkenForFlood(tile.accent) : tile.accent,
      pattern: tile.pattern,
      id: tile.id,
      phase: "expand",
    });
  };

  const handleOpenSpectrum = () => {
    if (flood) return;
    playTick();
    triggerHaptic();
    setScreen("spectrum");
  };

  const handleBackToHome = () => {
    setScreen(null);
  };

  /* Games report each round: correct answers grow that game's streak,
     a miss resets it, and either way the game is marked played. Both survive
     reloads via localStorage — Shapes instruments included. */
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
    accentColor: [...gamesList, ...shapesList].find((g) => g.id === id)?.accent ?? "#111116",
    onBack: handleBackToHome,
    onResult: (correct: boolean) => reportResult(id, correct),
    streak: streaks[id] ?? 0,
  });

  /* Home tiles read the progression engine's live streaks — re-read on
     every render; returning from a game re-renders home anyway */
  const engineProgress = getAllProgress();
  const tileStreak = (id: GameId) => engineProgress[id]?.streakCurrent ?? 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-paper text-ink flex flex-col font-sans antialiased">
        <div className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 flex flex-col">

          {/* Top bar — wordmark, session streak, sound */}
          <header className="flex items-center gap-3.5 pt-7 pb-5 border-b-[1.5px] border-line select-none">
            <PoloMark />
            <span className="font-display font-extrabold text-[17px] tracking-[0.02em]">POLO</span>
            <div className="ml-auto flex items-center gap-3 sm:gap-5">
              {/* The Spectrum self-check — top of the house, both modes */}
              <button
                id="vision-check-link"
                onClick={handleOpenSpectrum}
                className="font-mono font-extrabold text-[10.5px] tracking-[0.14em] uppercase text-ink inline-flex items-center gap-1.5 underline underline-offset-4 decoration-2 hover:decoration-play-blue cursor-pointer"
              >
                <span className="hidden sm:inline">Check your color vision</span>
                <span className="sm:hidden">Vision check</span>
              </button>
              <button
                id="leaderboard-link"
                onClick={() => {
                  if (flood) return;
                  playTick();
                  triggerHaptic();
                  setScreen("leaderboard");
                }}
                className="btn-press bg-paper px-3 sm:px-4 py-2 font-mono font-extrabold text-[10.5px] tracking-[0.14em] uppercase flex items-center gap-2 cursor-pointer text-ink"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M5 3h14v2h3v4c0 2.4-1.8 4.4-4.1 4.9A7 7 0 0 1 13 17.9V20h4v2H7v-2h4v-2.1a7 7 0 0 1-4.9-3.9C3.8 13.4 2 11.4 2 9V5h3V3Zm0 4H4v2c0 1.2.7 2.2 1.7 2.7A7 7 0 0 1 5 9V7Zm15 2V7h-1v2c0 .9-.2 1.8-.7 2.7 1-.5 1.7-1.5 1.7-2.7Z" />
                </svg>
                <span className="hidden sm:inline">Leaderboard</span>
              </button>
              <button
                id="theme-toggle-btn"
                onClick={handleToggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="btn-press bg-paper px-3 sm:px-4 py-2 font-mono font-extrabold text-[10.5px] tracking-[0.14em] uppercase flex items-center gap-2 cursor-pointer"
                aria-pressed={theme === "dark"}
              >
                <i className={`w-2 h-2 rounded-full ${theme === "dark" ? "bg-ink" : "bg-play-yellow"}`} />
                <span className="hidden sm:inline">{theme === "dark" ? "Lights off" : "Lights on"}</span>
              </button>
              <button
                id="sound-toggle-btn"
                onClick={handleToggleSound}
                aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
                className="btn-press bg-paper px-3 sm:px-4 py-2 font-mono font-extrabold text-[10.5px] tracking-[0.14em] uppercase flex items-center gap-2 cursor-pointer"
                aria-pressed={soundOn}
              >
                <i className={`w-2 h-2 rounded-full ${soundOn ? "bg-play-green" : "bg-line"}`} />
                <span className="hidden sm:inline">{soundOn ? "Sound on" : "Sound off"}</span>
              </button>
            </div>
          </header>

          <main className="flex-1 flex flex-col py-8">
            {!screen ? (
              <div className="flex flex-col flex-1">
                {/* Head — title on the left, the mode rocker on the right
                    where the ambient blocks used to drift */}
                <div className="relative mb-10 min-h-[128px] flex flex-col sm:flex-row sm:items-center gap-7 sm:gap-6">
                  <div className="flex flex-col justify-center">
                    <h1 className="relative font-display font-extrabold text-3xl sm:text-5xl tracking-tight text-ink mb-3">
                      Train your eye.
                    </h1>
                    <span className="relative font-mono font-medium text-[12px] tracking-[0.2em] uppercase text-mut tabular-nums">
                      Daily drill · <b className="text-ink font-extrabold">{doneCount} of {currentList.length}</b> instruments done
                    </span>
                  </div>
                  <div className="sm:ml-auto self-center sm:self-auto sm:pr-4">
                    <RockerSwitch mode={mode} onChange={handleSetMode} />
                  </div>
                </div>

                {/* Game tiles — they land, they don't appear. Keyed by mode so
                    switching replays the landing. */}
                <div id="games-grid" key={mode} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentList.map((game, i) => (
                    <motion.button
                      key={game.id}
                      id={`game-tile-${game.id}`}
                      onClick={(e) => handleSelectGame(game, e)}
                      initial={{ opacity: 0, y: 26, rotate: -1.5 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      transition={{ delay: 0.05 + i * 0.06, type: "spring", stiffness: 320, damping: 21 }}
                      className="tile-press bg-paper border-[1.5px] border-line rounded-3xl p-6 pb-5 text-left cursor-pointer flex flex-col"
                    >
                      <span className="tile-glyph h-[52px] flex items-center mb-4">{game.glyph}</span>
                      <span className="font-display font-medium text-[16px] text-ink mb-1.5">{game.name}</span>
                      <span className="text-[14px] text-mut leading-relaxed mb-5">{game.oneLiner}</span>
                      <span className="mt-auto flex items-center justify-between">
                        {tileStreak(game.id) > 0 ? (
                          <span className="font-mono font-extrabold text-[10.5px] tracking-[0.14em] uppercase chip-accent rounded-full px-2.5 py-1 tabular-nums">
                            Streak {tileStreak(game.id)}
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
                {screen === "swatch" && <SwatchGame {...gameProps("swatch")} />}
                {screen === "mix" && <MixGame {...gameProps("mix")} />}
                {screen === "echo" && <EchoGame {...gameProps("echo")} />}
                {screen === "between" && <BetweenGame {...gameProps("between")} />}
                {screen === "shift" && <ShiftGame {...gameProps("shift")} />}
                {screen === "tally" && <TallyGame {...gameProps("tally")} />}
                {screen === "form" && <FormGame {...gameProps("form")} />}
                {screen === "tilt" && <TiltGame {...gameProps("tilt")} />}
                {screen === "chain" && <ChainGame {...gameProps("chain")} />}
                {screen === "round" && <SquircleGame {...gameProps("round")} />}
                {screen === "shapeshift" && <ShapeShiftGame {...gameProps("shapeshift")} />}
                {screen === "shapetally" && <ShapeTallyGame {...gameProps("shapetally")} />}
                {screen === "spectrum" && <Spectrum onBack={handleBackToHome} />}
                {screen === "leaderboard" && <Leaderboard onBack={handleBackToHome} />}
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

        {/* Tile→game transition overlay: accent flood (Color) or B&W pattern
            wipe (Shapes) — same expand-then-fade, one continuous move */}
        {flood && (
          <motion.div
            className="fixed z-50 pointer-events-none overflow-hidden"
            style={{ background: flood.color ?? "var(--color-paper)" }}
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
                setScreen(flood.id);
                setFlood({ ...flood, phase: "fade" });
              } else {
                setFlood(null);
              }
            }}
          >
            {flood.pattern && <IconWipe pattern={flood.pattern} />}
          </motion.div>
        )}
      </div>
      <Analytics />
    </MotionConfig>
  );
}
