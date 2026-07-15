/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState } from "react";
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
import { Streak } from "./components/ui/Kit";

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

/* three.js is loaded lazily so the game itself never waits on it */
const AmbientBlocks = lazy(() => import("./components/AmbientBlocks"));

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
    name: "Count it all",
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
  /* One screen variable: a game, the Spectrum self-check, or home (null) */
  const [screen, setScreen] = useState<GameId | "spectrum" | null>(null);
  /* Which tile set is showing. Deliberately not persisted — every fresh
     load opens in Color mode. */
  const [mode, setMode] = useState<PlayMode>("color");
  const [soundOn, setSoundOn] = useState(true);
  const [played, setPlayed] = useState<Set<GameId>>(loadPlayed);
  const [streaks, setStreaks] = useState<StreakMap>(loadStreaks);
  const [flood, setFlood] = useState<Flood | null>(null);

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
      color: tile.accent,
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

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-paper text-ink flex flex-col font-sans antialiased">
        <div className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-8 flex flex-col">

          {/* Top bar — wordmark, session streak, sound */}
          <header className="flex items-center gap-3.5 pt-7 pb-5 border-b-[1.5px] border-line select-none">
            <PoloMark />
            <span className="font-display font-extrabold text-[17px] tracking-[0.02em]">POLO</span>
            <div className="ml-auto flex items-center gap-5">
              {!screen && <Streak total={currentList.length} done={doneCount} className="hidden sm:flex" />}
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
            {!screen ? (
              <div className="flex flex-col flex-1">
                {/* Head with the quiet 3D moment behind it */}
                <div className="relative mb-8 min-h-[128px] flex flex-col justify-center">
                  <Suspense fallback={null}>
                    <AmbientBlocks />
                  </Suspense>
                  <h1 className="relative font-display font-extrabold text-3xl sm:text-5xl tracking-tight text-ink mb-3">
                    Train your eye.
                  </h1>
                  <span className="relative font-mono font-medium text-[12px] tracking-[0.2em] uppercase text-mut tabular-nums">
                    Daily drill · <b className="text-ink font-extrabold">{doneCount} of {currentList.length}</b> instruments done
                  </span>
                </div>

                {/* Mode toggle — Color and Shapes swap the six instruments */}
                <div className="flex justify-center mb-7">
                  <div id="mode-toggle" className="inline-flex border-2 border-ink rounded-full p-1 bg-paper" role="tablist" aria-label="Game mode">
                    {(["color", "shapes"] as PlayMode[]).map((m) => (
                      <button
                        key={m}
                        id={`mode-toggle-${m}`}
                        role="tab"
                        aria-selected={mode === m}
                        onClick={() => handleSetMode(m)}
                        className={`px-6 py-2 rounded-full font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase cursor-pointer transition-colors ${
                          mode === m ? "bg-ink text-paper" : "text-ink hover:bg-wash"
                        }`}
                      >
                        {m === "color" ? "Color" : "Shapes"}
                      </button>
                    ))}
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

                {/* The Spectrum self-check — visible in both modes */}
                <div className="flex justify-center mt-9">
                  <button
                    id="vision-check-link"
                    onClick={handleOpenSpectrum}
                    className="font-mono font-extrabold text-[11px] tracking-[0.18em] uppercase text-ink inline-flex items-center gap-2 underline underline-offset-4 decoration-2 hover:decoration-play-blue cursor-pointer"
                  >
                    Check your color vision
                    <svg width="13" height="12" viewBox="0 0 14 12" aria-hidden="true">
                      <path d="M1.5 6h10.5M7.6 1.6 12 6l-4.4 4.4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
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
            {flood.pattern && (
              <span className={`polo-wipe polo-wipe-${flood.pattern}`} aria-hidden="true">
                <i />
              </span>
            )}
          </motion.div>
        )}
      </div>
      <Analytics />
    </MotionConfig>
  );
}
