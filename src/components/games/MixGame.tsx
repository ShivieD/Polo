/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { MixRoundData } from "../../types";
import { setupMixRound } from "../../utils/gameLogic";
import { hslToCss, getScoreForColors } from "../../utils/color";
import { GetReady } from "../GetReady";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
}

export const MixGame: React.FC<GameProps> = ({ accentColor, onBack }) => {
  const [stage, setStage] = useState<"getReady" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<MixRoundData>(() => setupMixRound());
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(4);

  // Restart/Next Round
  const handleNextRound = () => {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      setAutoAdvanceTimer(null);
    }
    setRoundData(setupMixRound());
    setStage("getReady");
    setCountdown(4);
  };

  // Handle stimulus timer
  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => {
        setStage("answer");
      }, 2000); // 2s stimulus
      return () => clearTimeout(timer);
    }
  }, [stage]);

  // Handle reveal auto-advance
  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();

      const interval = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);

      const timer = setTimeout(() => {
        handleNextRound();
      }, 5000); // 5s reveal to let them enjoy the accuracy score

      setAutoAdvanceTimer(timer as any);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [stage]);

  const handleDone = () => {
    if (stage !== "answer") return;

    playTick();
    triggerHaptic();

    const finalScore = getScoreForColors(roundData.targetColor, roundData.userColor);
    setRoundData((prev) => ({
      ...prev,
      score: finalScore,
    }));
    setStage("reveal");
  };

  const handleSliderChange = (key: "h" | "s" | "l", value: number) => {
    if (stage !== "answer") return;
    setRoundData((prev) => ({
      ...prev,
      userColor: {
        ...prev.userColor,
        [key]: value,
      },
    }));
  };

  // Build backgrounds for sliders for a beautiful, responsive UX
  const hueGradient = "linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)";
  const satGradient = `linear-gradient(to right, hsl(${roundData.userColor.h}, 0%, ${roundData.userColor.l}%), hsl(${roundData.userColor.h}, 100%, ${roundData.userColor.l}%))`;
  const lightGradient = `linear-gradient(to right, black, hsl(${roundData.userColor.h}, ${roundData.userColor.s}%, 50%), white)`;

  const score = roundData.score || 0;
  const isPerfect = score >= 90;
  const isGood = score >= 70 && score < 90;
  const isPoor = score < 70;

  return (
    <div id="mix-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto px-2 justify-between min-h-[480px]">
      
      {/* Top status bar (Editorial) */}
      <div className="flex justify-between items-center text-xs tracking-wider text-smoke font-mono select-none mb-6 pb-3 border-b border-ash uppercase">
        <span className="font-bold">MODULE 02: COLOR MIXER</span>
        {stage === "reveal" && (
          <span className="text-carbon-black font-bold">NEXT IN {countdown}s</span>
        )}
        {stage === "stimulus" && (
          <span className="text-slate font-bold animate-pulse">MEMORIZE THIS SPECTRUM...</span>
        )}
        {stage === "answer" && (
          <span className="text-carbon-black font-bold">MATCH THE TARGET SPECTRUM</span>
        )}
      </div>

      {/* Main board */}
      <div className="flex-1 flex flex-col justify-center py-4">
        {stage === "getReady" && (
          <GetReady 
            name="Color Mixer" 
            instructions="Look at the target color block. Then, slide the dials (Color Hue, Strength, Brightness) to recreate that exact color from memory!" 
            accentColor={accentColor} 
            onComplete={() => setStage("stimulus")} 
          />
        )}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center justify-center py-6">
            {/* Flat Brutalist Specimen Frame */}
            <div className="p-6 bg-paper-white rounded-[32px] w-full max-w-sm flex flex-col items-center border border-ash/40">
              <div className="text-center font-mono text-[10px] text-smoke tracking-widest uppercase mb-4">
                TARGET SPECTRUM SPECIMEN
              </div>
              
              <div 
                id="mix-stimulus-box"
                className="w-48 h-48 md:w-56 md:h-56 rounded-2xl"
                style={{ backgroundColor: hslToCss(roundData.targetColor) }}
              />
            </div>

            {/* Glowing Indicator Dot */}
            <div className="flex items-center gap-2 mt-6">
              <span className="w-2.5 h-2.5 rounded-full bg-voltage-yellow" />
              <span className="text-[10px] font-mono tracking-widest text-smoke uppercase">
                TARGET SAMPLING ACTIVE
              </span>
            </div>
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center w-full">
            
            {/* Live swatch viewport styled flat */}
            <div className="p-6 bg-paper-white border border-ash/40 rounded-[32px] mb-6 flex flex-col items-center">
              <div 
                id="mix-interactive-swatch"
                className="w-32 h-32 md:w-36 md:h-36 rounded-2xl"
                style={{ backgroundColor: hslToCss(roundData.userColor) }}
              />
              <div className="text-center font-mono text-[10px] text-smoke tracking-widest uppercase mt-3">
                LIVE COMPOSITE OUT
              </div>
            </div>

            {/* Custom Sliders styled flat */}
            <div className="w-full max-w-sm space-y-6 bg-paper-white p-6 rounded-[32px] border border-ash/40">
              
              {/* Hue Slider */}
              <div className="flex flex-col">
                <div className="flex justify-between text-[11px] tracking-widest font-mono font-bold text-carbon-black mb-2">
                  <span>HUE (COLOR SHADE)</span>
                  <span>{roundData.userColor.h}°</span>
                </div>
                <div className="relative flex items-center h-5">
                  <input
                    id="mix-slider-hue"
                    type="range"
                    min="0"
                    max="360"
                    value={roundData.userColor.h}
                    onChange={(e) => handleSliderChange("h", parseInt(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer focus:outline-none"
                    style={{ background: hueGradient }}
                  />
                </div>
              </div>

              {/* Saturation Slider */}
              <div className="flex flex-col">
                <div className="flex justify-between text-[11px] tracking-widest font-mono font-bold text-carbon-black mb-2">
                  <span>SATURATION (STRENGTH)</span>
                  <span>{roundData.userColor.s}%</span>
                </div>
                <div className="relative flex items-center h-5">
                  <input
                    id="mix-slider-saturation"
                    type="range"
                    min="0"
                    max="100"
                    value={roundData.userColor.s}
                    onChange={(e) => handleSliderChange("s", parseInt(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer focus:outline-none"
                    style={{ background: satGradient }}
                  />
                </div>
              </div>

              {/* Lightness Slider */}
              <div className="flex flex-col">
                <div className="flex justify-between text-[11px] tracking-widest font-mono font-bold text-carbon-black mb-2">
                  <span>LIGHTNESS (BRIGHTNESS)</span>
                  <span>{roundData.userColor.l}%</span>
                </div>
                <div className="relative flex items-center h-5">
                  <input
                    id="mix-slider-lightness"
                    type="range"
                    min="0"
                    max="100"
                    value={roundData.userColor.l}
                    onChange={(e) => handleSliderChange("l", parseInt(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer focus:outline-none"
                    style={{ background: lightGradient }}
                  />
                </div>
              </div>
            </div>

            {/* Tangible physical calibration complete button */}
            <button
              id="mix-done-btn"
              onClick={handleDone}
              className="mt-6 px-10 py-3.5 font-mono text-[11px] uppercase tracking-widest font-black transition-all duration-150 cursor-pointer rounded-lg bg-carbon-black text-paper-white hover:bg-carbon-black/95 active:scale-95 focus:outline-none flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-voltage-yellow" />
              <span>LOCK FREQUENCY</span>
            </button>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center w-full animate-fade-in">
            {/* Visual alignment check panel */}
            <div className="w-full max-w-sm p-6 bg-paper-white border border-ash/40 rounded-[32px] mb-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col items-center">
                  <div 
                    id="mix-reveal-target"
                    className="w-28 h-28 md:w-32 md:h-32 rounded-2xl"
                    style={{ backgroundColor: hslToCss(roundData.targetColor) }}
                  />
                  <span className="text-[10px] tracking-widest font-mono font-bold text-smoke uppercase mt-3 text-center">TARGET SPECIMEN</span>
                </div>
                <div className="flex flex-col items-center">
                  <div 
                    id="mix-reveal-guess"
                    className="w-28 h-28 md:w-32 md:h-32 rounded-2xl"
                    style={{ backgroundColor: hslToCss(roundData.userColor) }}
                  />
                  <span className="text-[10px] tracking-widest font-mono font-bold text-smoke uppercase mt-3 text-center">YOUR COMPOSITION</span>
                </div>
              </div>
            </div>

            {/* Scoreboard: Digital vintage indicator */}
            <div className="w-full max-w-sm p-6 rounded-[32px] border border-ash/40 bg-paper-white flex flex-col items-center">
              
              {/* LED lamps */}
              <div className="flex gap-10 mb-4 select-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-4 h-4 rounded-full border transition-all ${isPerfect ? "bg-mint-chip border-carbon-black" : "bg-mist-gray border-ash"}`} />
                  <span className="text-[9px] tracking-widest font-mono text-smoke font-bold">PERFECT</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-4 h-4 rounded-full border transition-all ${isGood ? "bg-voltage-yellow border-carbon-black" : "bg-mist-gray border-ash"}`} />
                  <span className="text-[9px] tracking-widest font-mono text-smoke font-bold">CLOSE</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-4 h-4 rounded-full border transition-all ${isPoor ? "bg-carbon-black border-carbon-black" : "bg-mist-gray border-ash"}`} />
                  <span className="text-[9px] tracking-widest font-mono text-smoke font-bold">RE-CALIBRATE</span>
                </div>
              </div>

              <div className="text-[10px] tracking-widest font-mono font-bold text-smoke uppercase mb-1">
                CLOSENESS SCORE
              </div>
              <div id="mix-reveal-score" className="text-4xl font-extrabold tracking-tight font-display text-carbon-black uppercase">
                {roundData.score}% MATCH
              </div>

              <div className="text-xs text-slate font-medium mt-3 text-center leading-relaxed">
                {isPerfect ? "Spectacular work! Absolute color resonance." : isGood ? "Very close! Excellent precision." : "Not quite. Practice sharpens your sight."}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="h-16 flex items-center justify-between select-none border-t border-ash mt-6 pt-2">
        <button 
          id="mix-back-btn"
          onClick={onBack}
          className="text-[10px] tracking-widest font-mono font-bold text-smoke hover:text-carbon-black transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
        >
          ← EXIT MODULE
        </button>

        {stage === "reveal" && (
          <button 
            id="mix-next-btn"
            onClick={handleNextRound}
            className="px-6 py-2.5 rounded-lg text-xs font-mono font-black tracking-widest cursor-pointer bg-carbon-black text-paper-white hover:bg-carbon-black/90 active:scale-95 transition-all focus:outline-none"
          >
            NEXT ROUND →
          </button>
        )}
      </div>
    </div>
  );
};
