/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { SwatchRoundData } from "../../types";
import { setupSwatchRound } from "../../utils/gameLogic";
import { hslToCss } from "../../utils/color";
import { GetReady } from "../GetReady";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
}

export const SwatchGame: React.FC<GameProps> = ({ accentColor, onBack }) => {
  const [stage, setStage] = useState<"getReady" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<SwatchRoundData>(() => setupSwatchRound());
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(3);

  // Restart/Next Round
  const handleNextRound = () => {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      setAutoAdvanceTimer(null);
    }
    setRoundData(setupSwatchRound());
    setStage("getReady");
    setCountdown(3);
  };

  // Handle stimulus timer
  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => {
        setStage("answer");
      }, 2000); // 2 seconds stimulus
      return () => clearTimeout(timer);
    }
  }, [stage]);

  // Handle auto-advance in reveal stage
  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();
      
      const interval = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);

      const timer = setTimeout(() => {
        handleNextRound();
      }, 4000); // 4 seconds reveal to let them inspect the result

      setAutoAdvanceTimer(timer as any);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [stage]);

  const handleSelectOption = (option: { color: any; isCorrect: boolean }) => {
    if (stage !== "answer") return;
    
    playTick();
    triggerHaptic();

    setRoundData((prev) => ({
      ...prev,
      userSelection: option.color,
    }));
    setStage("reveal");
  };

  const isUserCorrect = roundData.userSelection && 
    roundData.options.find(o => o.isCorrect)?.color.h === roundData.userSelection.h &&
    roundData.options.find(o => o.isCorrect)?.color.s === roundData.userSelection.s &&
    roundData.options.find(o => o.isCorrect)?.color.l === roundData.userSelection.l;

  return (
    <div id="swatch-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto px-2 justify-between min-h-[480px]">
      
      {/* Top status bar (Editorial layout) */}
      <div className="flex justify-between items-center text-xs tracking-wider text-smoke font-mono select-none mb-6 pb-3 border-b border-ash uppercase">
        <span className="font-bold">MODULE 01: COLOR MATCH</span>
        {stage === "reveal" && (
          <span className="text-carbon-black font-bold">NEXT IN {countdown}s</span>
        )}
        {stage === "stimulus" && (
          <span className="text-slate font-bold animate-pulse">LOOK AT THE COLOR BLOCK...</span>
        )}
        {stage === "answer" && (
          <span className="text-carbon-black font-bold">WHICH ONE WAS IT?</span>
        )}
      </div>

      {/* Main game board */}
      <div className="flex-1 flex flex-col justify-center py-4">
        {stage === "getReady" && (
          <GetReady 
            name="Color Match" 
            instructions="Look at the color block. We will hide it, then show you 4 options. Pick the exact one you just saw." 
            accentColor={accentColor} 
            onComplete={() => setStage("stimulus")} 
          />
        )}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center justify-center py-6">
            {/* Flat Brutalist Shield Frame */}
            <div className="p-6 bg-paper-white rounded-[32px] w-full max-w-sm flex flex-col items-center border border-ash/40">
              <div className="text-center font-mono text-[10px] text-smoke tracking-widest uppercase mb-4">
                STIMULUS SPECIMEN
              </div>
              
              <div 
                id="swatch-stimulus-box"
                className="w-48 h-48 md:w-56 md:h-56 rounded-2xl"
                style={{ backgroundColor: hslToCss(roundData.targetColor) }}
              />
            </div>

            {/* Voltage Yellow Light indicator */}
            <div className="flex items-center gap-2 mt-6">
              <span className="w-2.5 h-2.5 rounded-full bg-voltage-yellow" />
              <span className="text-[10px] font-mono tracking-widest text-smoke uppercase">
                ANALYSIS UNIT ACTIVE
              </span>
            </div>
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-bold tracking-tight text-carbon-black uppercase mb-6 text-center">
              Tap the exact match from the tray below:
            </h3>

            {/* Inset Tray for Options */}
            <div className="p-6 bg-paper-white rounded-[32px] w-full max-w-sm border border-ash/40">
              <div className="grid grid-cols-2 gap-6">
                {roundData.options.map((opt, idx) => (
                  <button
                    key={idx}
                    id={`swatch-option-${idx}`}
                    onClick={() => handleSelectOption(opt)}
                    className="aspect-square w-full cursor-pointer rounded-2xl border-none hover:scale-102 transition-transform active:scale-95 duration-100 focus:outline-none"
                    style={{ backgroundColor: hslToCss(opt.color) }}
                    aria-label={`Color option ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center animate-fade-in">
            {/* Flat Brutalist Feedback Card */}
            <div className="w-full max-w-md p-6 mb-6 rounded-[32px] bg-paper-white border border-ash/40 flex flex-col items-center text-center">
              
              {/* Dynamic Status Markers */}
              <div className="flex justify-center gap-12 mb-4">
                <div className="flex flex-col items-center gap-1.5">
                  <div 
                    className={`w-6 h-6 rounded-full transition-all duration-300 ${
                      isUserCorrect 
                        ? "bg-mint-chip border-2 border-carbon-black" 
                        : "bg-mist-gray border border-ash"
                    }`}
                  />
                  <span className="text-[9px] tracking-widest text-smoke font-mono font-bold">MATCH</span>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div 
                    className={`w-6 h-6 rounded-full transition-all duration-300 ${
                      !isUserCorrect 
                        ? "bg-carbon-black border-2 border-carbon-black" 
                        : "bg-mist-gray border border-ash"
                    }`}
                  />
                  <span className="text-[9px] tracking-widest text-smoke font-mono font-bold">ERROR</span>
                </div>
              </div>

              {/* Simple human language feedback */}
              <div className="text-2xl font-extrabold tracking-tight text-carbon-black mb-2 uppercase font-display leading-none">
                {isUserCorrect ? "Spot On! Excellent Eye!" : "Not Quite. Compare Them Below:"}
              </div>
              <p className="text-xs text-smoke font-mono uppercase tracking-wider">
                {isUserCorrect ? "Your observation matched the specimen perfectly." : "Check where the real color is highlighted."}
              </p>
            </div>

            {/* Target Display Tray with correct vs incorrect clearly labeled */}
            <div className="p-6 bg-paper-white rounded-[32px] w-full max-w-sm border border-ash/40">
              <div className="grid grid-cols-2 gap-6">
                {roundData.options.map((opt, idx) => {
                  const isThisCorrect = opt.isCorrect;
                  const isSelected = roundData.userSelection && 
                    roundData.userSelection.h === opt.color.h && 
                    roundData.userSelection.s === opt.color.s && 
                    roundData.userSelection.l === opt.color.l;
                  
                  // Clean flat high-contrast state styling
                  let borderStyle = "border-transparent";
                  
                  if (isThisCorrect) {
                    borderStyle = "border-mint-chip border-4 scale-102";
                  } else if (isSelected) {
                    borderStyle = "border-carbon-black border-4";
                  }

                  return (
                    <div
                      key={idx}
                      id={`swatch-reveal-option-${idx}`}
                      className={`aspect-square w-full rounded-2xl border-4 ${borderStyle} relative`}
                      style={{ backgroundColor: hslToCss(opt.color) }}
                    >
                      {/* Clear text overlays */}
                      {isThisCorrect && (
                        <div className="absolute top-2 left-2 text-[9px] font-mono font-black tracking-widest px-2 py-0.5 rounded text-carbon-black bg-mint-chip border border-carbon-black">
                          CORRECT
                        </div>
                      )}
                      {isSelected && !isThisCorrect && (
                        <div className="absolute top-2 left-2 text-[9px] font-mono font-black tracking-widest px-2 py-0.5 rounded text-paper-white bg-carbon-black">
                          YOURS
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="h-16 flex items-center justify-between select-none border-t border-ash mt-6 pt-2">
        <button 
          id="swatch-back-btn"
          onClick={onBack}
          className="text-[10px] tracking-widest font-mono font-bold text-smoke hover:text-carbon-black transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
        >
          ← EXIT MODULE
        </button>

        {stage === "reveal" && (
          <button 
            id="swatch-next-btn"
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
