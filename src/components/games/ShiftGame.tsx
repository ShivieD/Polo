/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { ShiftRoundData } from "../../types";
import { setupShiftRound } from "../../utils/gameLogic";
import { hslToCss } from "../../utils/color";
import { GetReady } from "../GetReady";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
}

type ShiftStage = "getReady" | "stimulus" | "interstitial" | "answer" | "reveal";

export const ShiftGame: React.FC<GameProps> = ({ accentColor, onBack }) => {
  const [stage, setStage] = useState<ShiftStage>("getReady");
  const [roundData, setRoundData] = useState<ShiftRoundData>(() => setupShiftRound());
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(3);

  // Restart/Next Round
  const handleNextRound = () => {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      setAutoAdvanceTimer(null);
    }
    setRoundData(setupShiftRound());
    setStage("getReady");
    setCountdown(3);
  };

  // Stimulus timers and interstitial
  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => {
        setStage("interstitial");
      }, 2000); // 2 seconds stimulus
      return () => clearTimeout(timer);
    }
    
    if (stage === "interstitial") {
      const timer = setTimeout(() => {
        setStage("answer");
      }, 400); // 0.4 seconds interstitial
      return () => clearTimeout(timer);
    }
  }, [stage]);

  // Reveal auto-advance
  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();

      const interval = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);

      const timer = setTimeout(() => {
        handleNextRound();
      }, 5000); // 5s reveal

      setAutoAdvanceTimer(timer as any);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [stage]);

  const handleSelectSquare = (idx: number) => {
    if (stage !== "answer") return;

    playTick();
    triggerHaptic();

    setRoundData((prev) => ({
      ...prev,
      userSelection: idx,
    }));
    setStage("reveal");
  };

  const isUserCorrect = roundData.userSelection === roundData.shiftedIndex;

  return (
    <div id="shift-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto px-2 justify-between min-h-[480px]">
      
      {/* Top status bar */}
      <div className="flex justify-between items-center text-xs tracking-wider text-smoke font-mono select-none mb-6 pb-3 border-b border-ash uppercase">
        <span className="font-bold">MODULE 05: SHIFT DIFFERENCE</span>
        {stage === "reveal" && (
          <span className="text-carbon-black font-bold">NEXT IN {countdown}s</span>
        )}
        {stage === "stimulus" && (
          <span className="text-slate font-bold animate-pulse">MEMORIZE ALL FOUR BLOCKS...</span>
        )}
        {stage === "interstitial" && (
          <span className="text-slate font-bold">RETAIN DETAILS NOW...</span>
        )}
        {stage === "answer" && (
          <span className="text-carbon-black font-bold">WHICH BLOCK CHANGED COLOR?</span>
        )}
      </div>

      {/* Main board */}
      <div className="flex-1 flex flex-col justify-center py-4">
        {stage === "getReady" && (
          <GetReady 
            name="Spot the Difference" 
            instructions="Look closely at the 4 color blocks. We will cover them briefly, then show them again with ONE block slightly changed. Tap the block that changed!" 
            accentColor={accentColor} 
            onComplete={() => setStage("stimulus")} 
          />
        )}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-bold tracking-tight text-carbon-black uppercase mb-8 text-center">
              MEMORIZING COLOR COMPOSITION...
            </h3>
            
            {/* Flat Brutalist Tray */}
            <div className="p-8 bg-paper-white rounded-[32px] border border-ash/40 w-full max-w-sm">
              <div className="grid grid-cols-4 gap-4">
                {roundData.originalColors.map((color, idx) => (
                  <div
                    key={idx}
                    id={`shift-stimulus-square-${idx}`}
                    className="aspect-square w-full rounded-xl border border-ash/40"
                    style={{ backgroundColor: hslToCss(color) }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {stage === "interstitial" && (
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-bold tracking-tight text-carbon-black uppercase mb-8 text-center animate-pulse">
              SHUTTER CLOSED
            </h3>

            {/* Flat shutter block */}
            <div className="p-8 bg-paper-white rounded-[32px] border border-ash/40 w-full max-w-sm">
              <div className="grid grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    id={`shift-interstitial-square-${idx}`}
                    className="aspect-square w-full bg-mist-gray border border-ash rounded-xl flex items-center justify-center"
                  >
                    {/* Minimal decorative lines */}
                    <div className="flex flex-col gap-1 w-full items-center opacity-40">
                      <div className="w-4 h-[1px] bg-smoke" />
                      <div className="w-4 h-[1px] bg-smoke" />
                      <div className="w-4 h-[1px] bg-smoke" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-bold tracking-tight text-carbon-black uppercase mb-8 text-center">
              TAP THE ONE BLOCK THAT HAS A DIFFERENT SHADE:
            </h3>

            <div className="p-8 bg-paper-white rounded-[32px] border border-ash/40 w-full max-w-sm">
              <div className="grid grid-cols-4 gap-4">
                {roundData.shiftedColors.map((color, idx) => (
                  <button
                    key={idx}
                    id={`shift-answer-square-${idx}`}
                    onClick={() => handleSelectSquare(idx)}
                    className="aspect-square w-full rounded-xl border border-ash/40 transition-transform active:scale-95 duration-100 cursor-pointer focus:outline-none hover:bg-mist-gray/40"
                    style={{ backgroundColor: hslToCss(color) }}
                    aria-label={`Shift option square ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center w-full select-none animate-fade-in">
            
            {/* Visual Panel Feedback */}
            <div className="w-full max-w-sm p-6 mb-6 rounded-[32px] border border-ash/40 bg-paper-white flex flex-col items-center text-center">
              
              {/* LED Status lights */}
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

              {/* Simple human feedback */}
              <h3 className="text-2xl font-extrabold tracking-tight font-display text-carbon-black uppercase leading-none mb-2">
                {isUserCorrect ? "Shift Detected!" : "Shift Missed"}
              </h3>
              <p className="text-xs text-smoke font-mono uppercase tracking-wider">
                {isUserCorrect ? "Your observation was extremely precise." : "The shifted cell is highlighted below."}
              </p>
            </div>

            {/* Shift grid with clear highlights & comparison on mismatch */}
            <div className="p-6 bg-paper-white rounded-[32px] border border-ash/40 w-full max-w-sm space-y-6">
              
              {/* Show original grid ONLY on mismatch */}
              {!isUserCorrect && (
                <div className="animate-fade-in">
                  <div className="text-[10px] tracking-widest text-smoke font-mono font-bold mb-3 uppercase text-left flex items-center justify-between">
                    <span>ORIGINAL GRID (BEFORE SHIFT)</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-smoke animate-pulse" />
                  </div>
                  <div className="grid grid-cols-4 gap-4 pb-5 border-b border-ash/30">
                    {roundData.originalColors.map((color, idx) => {
                      const isShifted = roundData.shiftedIndex === idx;
                      return (
                        <div
                          key={idx}
                          id={`shift-original-reveal-square-${idx}`}
                          className={`aspect-square w-full rounded-xl border relative transition-all duration-300 ${
                            isShifted 
                              ? "border-carbon-black border-2 scale-105 shadow-sm z-10" 
                              : "border-ash/40 opacity-70"
                          }`}
                          style={{ backgroundColor: hslToCss(color) }}
                        >
                          {isShifted && (
                            <div className="absolute -top-2 -left-2 text-[7px] font-mono font-black tracking-wider px-1 py-0.5 rounded border border-carbon-black bg-paper-white text-carbon-black uppercase shadow-xs">
                              WAS
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shifted grid */}
              <div>
                {!isUserCorrect && (
                  <div className="text-[10px] tracking-widest text-smoke font-mono font-bold mb-3 uppercase text-left flex items-center justify-between">
                    <span>SHIFTED GRID (AFTER SHIFT)</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-voltage-yellow" />
                  </div>
                )}
                <div className="grid grid-cols-4 gap-4">
                  {roundData.shiftedColors.map((color, idx) => {
                    const isShifted = roundData.shiftedIndex === idx;
                    const isSelected = roundData.userSelection === idx;

                    // Clear high-contrast borders
                    let borderStyle = "border-ash";

                    if (isShifted) {
                      borderStyle = "border-carbon-black border-2 scale-105 z-10";
                    } else if (isSelected) {
                      borderStyle = "border-smoke border-2 scale-95";
                    }

                    return (
                      <div
                        key={idx}
                        id={`shift-reveal-square-${idx}`}
                        className={`aspect-square w-full rounded-xl border ${borderStyle} relative`}
                        style={{ backgroundColor: hslToCss(color) }}
                      >
                        {isShifted && (
                          <div className="absolute -top-2 -left-2 text-[7px] font-mono font-black tracking-wider px-1 py-0.5 rounded border border-carbon-black bg-voltage-yellow text-carbon-black uppercase">
                            DIFF
                          </div>
                        )}
                        {isSelected && !isShifted && (
                          <div className="absolute -top-2 -left-2 text-[7px] font-mono font-black tracking-wider px-1 py-0.5 rounded border border-carbon-black bg-paper-white text-carbon-black uppercase">
                            YOU
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="h-16 flex items-center justify-between select-none border-t border-ash mt-6 pt-2">
        <button 
          id="shift-back-btn"
          onClick={onBack}
          className="text-[10px] tracking-widest font-mono font-bold text-smoke hover:text-carbon-black transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
        >
          ← EXIT MODULE
        </button>

        {stage === "reveal" && (
          <button 
            id="shift-next-btn"
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
