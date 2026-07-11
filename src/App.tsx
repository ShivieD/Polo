/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Volume2, VolumeX, Moon, Sun, ArrowLeft } from "lucide-react";
import { GameId } from "./types";
import { toggleSound, isSoundEnabled, playTick, triggerHaptic } from "./utils/audio";
import { 
  SwatchIcon, 
  MixIcon, 
  EchoIcon, 
  BetweenIcon, 
  ShiftIcon, 
  TallyIcon 
} from "./components/GameIcons";

// Import mini-game components
import { SwatchGame } from "./components/games/SwatchGame";
import { MixGame } from "./components/games/MixGame";
import { EchoGame } from "./components/games/EchoGame";
import { BetweenGame } from "./components/games/BetweenGame";
import { ShiftGame } from "./components/games/ShiftGame";
import { TallyGame } from "./components/games/TallyGame";

// 50-year-old friendly simplified names and descriptions
const gamesList = [
  {
    id: "swatch" as GameId,
    name: "Color Match",
    oneLiner: "Look at a color, then find it in a grid of similar colors.",
    accent: "#E54B3B", // Braun Red-Orange
    icon: SwatchIcon,
  },
  {
    id: "mix" as GameId,
    name: "Color Mixer",
    oneLiner: "Slide the dials to match the target color perfectly.",
    accent: "#FF9F00", // Braun Amber-Yellow
    icon: MixIcon,
  },
  {
    id: "echo" as GameId,
    name: "Repeat the Pattern",
    oneLiner: "Watch tiles light up and tap them in that exact order.",
    accent: "#00E5A3", // Braun minty indicator
    icon: EchoIcon,
  },
  {
    id: "between" as GameId,
    name: "Find the Spot",
    oneLiner: "Slide the dial needle to where the color block belongs on the bar.",
    accent: "#E54B3B", // Braun Red-Orange
    icon: BetweenIcon,
  },
  {
    id: "shift" as GameId,
    name: "Spot the Difference",
    oneLiner: "Find the single block that changed color when hidden.",
    accent: "#3B82F6", // Braun tuning blue
    icon: ShiftIcon,
  },
  {
    id: "tally" as GameId,
    name: "Count the Dots",
    oneLiner: "Count the fast dots on the screen before they disappear.",
    accent: "#FF9F00", // Braun Amber-Yellow
    icon: TallyIcon,
  }
];

export default function App() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Sync theme with document class list
  useEffect(() => {
    // Read initial theme preference or set dark
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const initialTheme = media.matches ? "dark" : "light";
    setTheme(initialTheme);
    
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const handleSetTheme = (newTheme: "light" | "dark") => {
    playTick();
    triggerHaptic();
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleToggleSound = () => {
    const newState = toggleSound();
    setSoundOn(newState);
    if (newState) {
      setTimeout(() => {
        playTick();
        triggerHaptic();
      }, 50);
    }
  };

  const handleSelectGame = (id: GameId) => {
    playTick();
    triggerHaptic();
    setActiveGame(id);
  };

  const handleBackToHome = () => {
    playTick();
    triggerHaptic();
    setActiveGame(null);
  };

  const selectedGameInfo = gamesList.find((g) => g.id === activeGame);

  return (
    <div className="min-h-screen bg-warm-canvas text-carbon-black flex flex-col font-sans select-none antialiased p-4 sm:p-6 md:p-8">
      
      {/* Centered Editorial Showroom Layout */}
      <div className="flex-1 max-w-5xl w-full mx-auto flex flex-col justify-between relative">
        
        {/* Editorial Top Control Bar */}
        <header className="w-full pb-8 mb-8 border-b border-ash flex flex-col md:flex-row justify-between items-start md:items-end gap-6 select-none">
          <div className="flex items-start gap-4">
            {activeGame && (
              <button
                id="back-btn"
                onClick={handleBackToHome}
                className="mt-1 p-3 bg-carbon-black text-paper-white rounded-lg hover:bg-carbon-black/90 active:scale-95 transition-all cursor-pointer focus:outline-none flex items-center justify-center"
                title="Back to main panel"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex flex-col">
              <span className="text-5xl md:text-7xl font-extrabold tracking-tight font-display text-carbon-black uppercase leading-0.9">
                POLO
              </span>
              <span className="text-[10px] tracking-widest text-smoke font-mono uppercase mt-1">
                SENSORY ATTENTION DEVICE — MODEL T2
              </span>
            </div>
          </div>

          {/* Sound Control in Brutalist Style */}
          <div className="flex items-center gap-6">
            
            <div className="flex flex-col items-start md:items-end">
              <span className="text-[9px] tracking-widest text-smoke font-mono uppercase mb-2">AUDIO STATE</span>
              <button
                id="sound-toggle-btn"
                onClick={handleToggleSound}
                className={`relative px-4 py-2 font-mono text-[11px] tracking-widest font-black uppercase transition-all duration-150 cursor-pointer rounded-lg border flex items-center gap-2 select-none ${
                  soundOn
                    ? "bg-mint-chip border-carbon-black text-carbon-black"
                    : "bg-paper-white border-ash hover:border-carbon-black text-slate"
                }`}
              >
                <span 
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    soundOn 
                      ? "bg-carbon-black" 
                      : "bg-ash"
                  }`}
                />
                {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>{soundOn ? "SOUND ON" : "SOUND OFF"}</span>
              </button>
            </div>

          </div>
        </header>

        {/* Dynamic Display Screen Area */}
        <main className="flex-1 flex flex-col justify-center py-4 select-none">
          {!activeGame ? (
            // Home Menu
            <div className="flex flex-col flex-1 justify-center py-4">
              
              {/* Dieter Rams Philosophy Statement */}
              <div className="max-w-2xl mb-12 px-2">
                <p className="text-2xl md:text-3xl font-bold tracking-tight text-carbon-black mb-3">
                  "Weniger, aber besser" — Less, but better.
                </p>
                <p className="text-sm text-slate font-medium max-w-lg leading-relaxed">
                  Train your senses daily. Select an instrument module below to begin. Polo runs on a brutalist-editorial logic: flat paper surfaces, zero elevation effects, and high typographic scale.
                </p>
              </div>

              {/* Exquisite flat Grid: 2x3 layout */}
              <div 
                id="games-grid"
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl w-full"
              >
                {gamesList.map((game) => {
                  const IconComponent = game.icon;
                  return (
                    <div
                      key={game.id}
                      id={`game-tile-${game.id}`}
                      onClick={() => handleSelectGame(game.id)}
                      className="flex flex-col justify-between p-6 bg-paper-white rounded-[32px] cursor-pointer group transition-all duration-200 hover:bg-mist-gray border border-transparent hover:border-ash min-h-[280px]"
                    >
                      {/* Grid Tile Header */}
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-mono font-bold tracking-widest text-smoke uppercase">
                            MODULE
                          </span>
                          <span className="text-lg font-bold tracking-tight text-carbon-black uppercase">
                            {game.name}
                          </span>
                        </div>
                        
                        {/* Status tag using the mint or yellow palette */}
                        <div className="flex items-center">
                          <span 
                            className="text-[10px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-[64px] border uppercase"
                            style={{ 
                              borderColor: game.accent,
                              backgroundColor: `${game.accent}20`,
                              color: game.accent,
                            }}
                          >
                            READY
                          </span>
                        </div>
                      </div>

                      {/* Monoline Icon container in the center */}
                      <div className="flex justify-center my-4 select-none pointer-events-none">
                        <div className="w-20 h-20 rounded-full bg-mist-gray border border-ash flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                          <IconComponent 
                            className="w-8 h-8 text-carbon-black transition-colors" 
                            accentColor={game.accent}
                          />
                        </div>
                      </div>

                      {/* Clear, simple, high-contrast label */}
                      <p className="text-xs font-medium text-slate leading-relaxed text-center group-hover:text-carbon-black transition-colors">
                        {game.oneLiner}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Mini-Game Frame with Clean Transition
            <div className="flex-1 flex flex-col justify-center animate-fade-in">
              {activeGame === "swatch" && (
                <SwatchGame accentColor={selectedGameInfo!.accent} onBack={handleBackToHome} />
              )}
              {activeGame === "mix" && (
                <MixGame accentColor={selectedGameInfo!.accent} onBack={handleBackToHome} />
              )}
              {activeGame === "echo" && (
                <EchoGame accentColor={selectedGameInfo!.accent} onBack={handleBackToHome} />
              )}
              {activeGame === "between" && (
                <BetweenGame accentColor={selectedGameInfo!.accent} onBack={handleBackToHome} />
              )}
              {activeGame === "shift" && (
                <ShiftGame accentColor={selectedGameInfo!.accent} onBack={handleBackToHome} />
              )}
              {activeGame === "tally" && (
                <TallyGame accentColor={selectedGameInfo!.accent} onBack={handleBackToHome} />
              )}
            </div>
          )}
        </main>

        {/* Brutalist Footer with Clean Lines */}
        <footer className="w-full mt-12 pt-6 border-t border-ash flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] tracking-widest font-mono text-smoke uppercase select-none">
          {/* Functional speaker grille dots without skeuomorphism */}
          <div className="flex gap-2 items-center">
            {[...Array(6)].map((_, i) => (
              <div 
                key={i} 
                className="w-1.5 h-1.5 bg-carbon-black rounded-full" 
              />
            ))}
          </div>

          <span>SYSTEM LOGIC — POLO DIGITAL SENSORY SYNTHESIS</span>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00FFCC] animate-pulse" />
            <span className="text-carbon-black">UNIT ONLINE</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
