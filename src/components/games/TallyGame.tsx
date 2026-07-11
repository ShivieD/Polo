/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { TallyRoundData } from "../../types";
import { setupTallyRound } from "../../utils/gameLogic";
import { GetReady } from "../GetReady";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
}

export const TallyGame: React.FC<GameProps> = ({ accentColor, onBack }) => {
  const [stage, setStage] = useState<"getReady" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [roundData, setRoundData] = useState<TallyRoundData>(() => setupTallyRound(1));
  const [visibleDotsCount, setVisibleDotsCount] = useState<number>(0);
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(4);

  // Restart/Next Round
  const handleNextRound = () => {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      setAutoAdvanceTimer(null);
    }
    const wasCorrect = roundData.userSelection === roundData.trueCount;
    const nextRound = wasCorrect ? roundNumber + 1 : roundNumber;
    setRoundNumber(nextRound);
    setRoundData(setupTallyRound(nextRound));
    setVisibleDotsCount(0);
    setStage("getReady");
    setCountdown(4);
  };

  // Stimulus timer: Pop circles one by one, scaling speed based on the round/run number
  useEffect(() => {
    if (stage === "stimulus") {
      setVisibleDotsCount(0);
      let dotsPopped = 0;
      const totalDots = roundData.points.length;
      
      // Calculate delay per dot: Round 1 has 250ms delay, getting faster each round
      const popSpeed = Math.max(30, Math.round(250 / (1 + (roundNumber - 1) * 0.45)));

      const interval = setInterval(() => {
        if (dotsPopped < totalDots) {
          dotsPopped++;
          setVisibleDotsCount(dotsPopped);
          playTick();
        } else {
          clearInterval(interval);
          // Keep all dots displayed for a small holding time before showing options
          const transitionTimer = setTimeout(() => {
            setStage("answer");
          }, 850);
          return () => clearTimeout(transitionTimer);
        }
      }, popSpeed);

      return () => {
        clearInterval(interval);
      };
    }
  }, [stage, roundNumber, roundData.points.length]);

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

  const handleSelectOption = (num: number) => {
    if (stage !== "answer") return;

    playTick();
    triggerHaptic();

    setRoundData((prev) => ({
      ...prev,
      userSelection: num,
    }));
    setStage("reveal");
  };

  const isUserCorrect = roundData.userSelection === roundData.trueCount;

  return (
    <div id="tally-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto px-2 justify-between min-h-[480px]">
      
      {/* Top status bar */}
      <div className="flex justify-between items-center text-xs tracking-wider text-smoke font-mono select-none mb-6 pb-3 border-b border-ash uppercase">
        <span className="font-bold">MODULE 06: SPOT COUNTING (RUN #{roundNumber})</span>
        {stage === "reveal" && (
          <span className="text-carbon-black font-bold">NEXT IN {countdown}s</span>
        )}
        {stage === "stimulus" && (
          <span className="text-slate font-bold animate-pulse">COUNT THE DOTS QUICKLY!</span>
        )}
        {stage === "answer" && (
          <span className="text-carbon-black font-bold">HOW MANY DOTS DID YOU SEE?</span>
        )}
      </div>

      {/* Main board */}
      <div className="flex-1 flex flex-col justify-center py-4">
        {stage === "getReady" && (
          <GetReady 
            name="Count the Dots" 
            instructions="A quick group of dots will flash on the screen. Count them as fast as you can, then pick the correct number from the dials." 
            accentColor={accentColor} 
            onComplete={() => setStage("stimulus")} 
          />
        )}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center">
            {/* Flat circular scope representing a focus scanner */}
            <div className="p-4 bg-paper-white border border-ash/40 rounded-full">
              <div 
                id="tally-scatter-container"
                className="w-64 h-64 md:w-72 md:h-72 border border-ash bg-mist-gray relative overflow-hidden rounded-full"
              >
                {/* Sonar sweep lines */}
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-ash/40" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-ash/40" />
                
                {roundData.points.map((pt, idx) => {
                  const isVisible = idx < visibleDotsCount;
                  return (
                    <div
                      key={idx}
                      id={`tally-circle-${idx}`}
                      className="absolute rounded-full bg-carbon-black transition-all duration-200 ease-out"
                      style={{
                        left: `${pt.x}%`,
                        top: `${pt.y}%`,
                        width: `${pt.r * 2}px`,
                        height: `${pt.r * 2}px`,
                        transform: `translate(-50%, -50%) scale(${isVisible ? 1 : 0})`,
                        opacity: isVisible ? 1 : 0,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Amber beacon */}
            <div className="flex items-center gap-2 mt-6">
              <span className="w-2.5 h-2.5 rounded-full bg-voltage-yellow border border-carbon-black" />
              <span className="text-[10px] font-mono tracking-widest text-smoke uppercase font-bold">
                EMISSION COMPLETED
              </span>
            </div>
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center w-full">
            {/* Empty board as placeholder */}
            <div className="p-4 bg-paper-white border border-ash/40 rounded-full mb-8">
              <div 
                id="tally-empty-container"
                className="w-48 h-48 rounded-full border border-dashed border-ash bg-transparent flex items-center justify-center"
              >
                <span className="text-[10px] font-mono tracking-widest text-smoke uppercase font-bold text-center max-w-[120px] leading-relaxed">
                  DOTS HIDDEN<br/>CHOOSE COUNT
                </span>
              </div>
            </div>

            {/* Answers grid of push buttons */}
            <div className="p-6 bg-paper-white rounded-[32px] border border-ash/40 w-full max-w-sm">
              <div className="grid grid-cols-4 gap-4 select-none">
                {roundData.options.map((opt) => (
                  <button
                    key={opt}
                    id={`tally-option-${opt}`}
                    onClick={() => handleSelectOption(opt)}
                    className="py-3.5 rounded-xl bg-paper-white text-carbon-black font-mono text-lg font-extrabold tracking-wider border border-ash hover:bg-mist-gray/40 active:scale-95 transition-all cursor-pointer focus:outline-none flex items-center justify-center"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center w-full select-none animate-fade-in">
            {/* Show scatter board to verify count */}
            <div className="p-4 bg-paper-white border border-ash/40 rounded-full mb-6">
              <div 
                id="tally-reveal-scatter"
                className="w-48 h-48 border border-ash bg-mist-gray relative overflow-hidden rounded-full"
              >
                {roundData.points.map((pt, idx) => (
                  <div
                    key={idx}
                    id={`tally-reveal-circle-${idx}`}
                    className="absolute rounded-full bg-carbon-black"
                    style={{
                      left: `${pt.x}%`,
                      top: `${pt.y}%`,
                      width: `${pt.r * 1.8}px`,
                      height: `${pt.r * 1.8}px`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Binary outcome panel */}
            <div className="w-full max-w-sm p-6 mb-6 rounded-[32px] border border-ash/40 bg-paper-white flex flex-col items-center text-center">
              
              {/* LED lamps */}
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

              {/* Simple outcome text */}
              <h3 className="text-2xl font-extrabold tracking-tight font-display text-carbon-black uppercase leading-none mb-2">
                {isUserCorrect ? "Exact Count Match!" : `Miscounted by ${Math.abs(roundData.userSelection - roundData.trueCount)}`}
              </h3>
              <p className="text-xs text-smoke font-mono uppercase tracking-wider">
                {isUserCorrect ? "Your subitizing radar is calibrated." : `There were exactly ${roundData.trueCount} dots.`}
              </p>
            </div>

            {/* Interactive button layout showing choice and real counts */}
            <div className="p-6 bg-paper-white rounded-[32px] border border-ash/40 w-full max-w-sm">
              <div className="grid grid-cols-4 gap-4 select-none">
                {roundData.options.map((opt) => {
                  const isTrue = opt === roundData.trueCount;
                  const isSelected = opt === roundData.userSelection;

                  let borderStyle = "border-ash text-smoke bg-paper-white opacity-50";

                  if (isTrue) {
                    borderStyle = "border-carbon-black border-2 scale-105 bg-voltage-yellow text-carbon-black z-10 font-extrabold";
                  } else if (isSelected) {
                    borderStyle = "border-smoke border-2 scale-95 bg-paper-white text-carbon-black font-extrabold";
                  }

                  return (
                    <div
                      key={opt}
                      id={`tally-reveal-option-${opt}`}
                      className={`py-3 rounded-xl border font-mono text-base flex flex-col items-center justify-center relative ${borderStyle}`}
                    >
                      <span>{opt}</span>
                      {isTrue && (
                        <span className="text-[7px] tracking-tight uppercase absolute -bottom-3.5 font-mono text-center w-full font-black text-carbon-black">
                          TRUE
                        </span>
                      )}
                      {isSelected && !isTrue && (
                        <span className="text-[7px] tracking-tight uppercase absolute -bottom-3.5 font-mono text-center w-full font-black text-smoke">
                          YOU
                        </span>
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
          id="tally-back-btn"
          onClick={onBack}
          className="text-[10px] tracking-widest font-mono font-bold text-smoke hover:text-carbon-black transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
        >
          ← EXIT MODULE
        </button>

        {stage === "reveal" && (
          <button 
            id="tally-next-btn"
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
