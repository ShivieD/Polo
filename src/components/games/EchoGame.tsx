/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { EchoRoundData } from "../../types";
import { setupEchoRound } from "../../utils/gameLogic";
import { hslToCss } from "../../utils/color";
import { GetReady } from "../GetReady";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
}

export const EchoGame: React.FC<GameProps> = ({ accentColor, onBack }) => {
  const [stage, setStage] = useState<"getReady" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<EchoRoundData>(() => setupEchoRound());
  const [activeStimulusIndex, setActiveStimulusIndex] = useState<number>(-1);
  const [replayIndex, setReplayIndex] = useState<number>(-1);
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(5);

  // Restart/Next Round
  const handleNextRound = () => {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      setAutoAdvanceTimer(null);
    }
    setRoundData(setupEchoRound());
    setActiveStimulusIndex(-1);
    setReplayIndex(-1);
    setStage("getReady");
    setCountdown(5);
  };

  // Play stimulus sequence
  useEffect(() => {
    if (stage === "stimulus") {
      let step = 0;
      
      const playStep = () => {
        if (step < roundData.sequence.length) {
          const squareIdx = roundData.sequence[step];
          setActiveStimulusIndex(squareIdx);
          playTick();
          step++;
          setTimeout(playStep, 600); // 0.6s per square
        } else {
          setActiveStimulusIndex(-1);
          setTimeout(() => {
            setStage("answer");
          }, 350);
        }
      };

      const startTimer = setTimeout(playStep, 600);
      return () => clearTimeout(startTimer);
    }
  }, [stage, roundData.sequence]);

  // Play reveal and replay sequence
  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();
      
      const interval = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);

      // Replay sequence at same tempo
      let replayStep = 0;
      const playReplay = () => {
        if (replayStep < roundData.sequence.length) {
          setReplayIndex(roundData.sequence[replayStep]);
          playTick();
          replayStep++;
          setTimeout(playReplay, 600);
        } else {
          setReplayIndex(-1);
        }
      };

      const replayTimer = setTimeout(playReplay, 500);

      const autoTimer = setTimeout(() => {
        handleNextRound();
      }, 5000); // 5s reveal & replay window

      setAutoAdvanceTimer(autoTimer as any);

      return () => {
        clearInterval(interval);
        clearTimeout(replayTimer);
        clearTimeout(autoTimer);
      };
    }
  }, [stage, roundData.sequence]);

  const handleSquareTap = (idx: number) => {
    if (stage !== "answer") return;
    
    // Prevent double tapping same square
    if (roundData.userTaps.includes(idx)) return;

    playTick();
    triggerHaptic();

    const updatedTaps = [...roundData.userTaps, idx];
    
    setRoundData((prev) => ({
      ...prev,
      userTaps: updatedTaps,
    }));

    if (updatedTaps.length === 4) {
      const isCorrect = updatedTaps.join(",") === roundData.sequence.join(",");
      setRoundData((prev) => ({
        ...prev,
        isCorrect,
      }));
      setStage("reveal");
    }
  };

  const isTapped = (id: number) => roundData.userTaps.includes(id);
  const tapOrder = (id: number) => roundData.userTaps.indexOf(id) + 1;

  return (
    <div id="echo-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto px-2 justify-between min-h-[480px]">
      
      {/* Top status bar (Editorial) */}
      <div className="flex justify-between items-center text-xs tracking-wider text-smoke font-mono select-none mb-6 pb-3 border-b border-ash uppercase">
        <span className="font-bold">MODULE 03: PATTERN ECHO</span>
        {stage === "reveal" && (
          <span className="text-carbon-black font-bold">NEXT IN {countdown}s</span>
        )}
        {stage === "stimulus" && (
          <span className="text-slate font-bold animate-pulse">WATCH THE FLASHES...</span>
        )}
        {stage === "answer" && (
          <span className="text-carbon-black font-bold">TAP IN THE EXACT ORDER ({roundData.userTaps.length}/4)</span>
        )}
      </div>

      {/* Main board */}
      <div className="flex-1 flex flex-col justify-center py-4">
        {stage === "getReady" && (
          <GetReady 
            name="Repeat the Pattern" 
            instructions="Watch the 4 physical buttons light up. Remember their order, then press the buttons in that exact same pattern." 
            accentColor={accentColor} 
            onComplete={() => setStage("stimulus")} 
          />
        )}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-bold tracking-tight text-carbon-black uppercase mb-8 text-center animate-pulse">
              RECORDING PATTERN SEQUENCE...
            </h3>
            
            {/* Flat Brutalist tray */}
            <div className="p-8 bg-paper-white rounded-[32px] border border-ash/40 w-full max-w-sm">
              <div className="grid grid-cols-4 gap-4">
                {roundData.squares.map((sq) => {
                  const isActive = activeStimulusIndex === sq.id;
                  const activeColor = hslToCss(sq.color);
                  
                  return (
                    <div
                      key={sq.id}
                      id={`echo-stimulus-square-${sq.id}`}
                      className={`aspect-square w-full rounded-xl border transition-all duration-150 flex items-center justify-center relative ${
                        isActive 
                          ? "bg-mist-gray border-carbon-black scale-95" 
                          : "bg-paper-white border-ash hover:bg-mist-gray/40"
                      }`}
                    >
                      {/* Central concave circle */}
                      <div className="w-8 h-8 rounded-full bg-mist-gray/60 flex items-center justify-center">
                        {/* Glow LED inside */}
                        <div 
                          className="w-3.5 h-3.5 rounded-full transition-all duration-150"
                          style={{
                            backgroundColor: isActive ? activeColor : "transparent",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-bold tracking-tight text-carbon-black uppercase mb-8 text-center">
              Replay the pattern sequence:
            </h3>

            {/* Tap Panel */}
            <div className="p-8 bg-paper-white rounded-[32px] border border-ash/40 w-full max-w-sm">
              <div className="grid grid-cols-4 gap-4">
                {roundData.squares.map((sq) => {
                  const hasBeenTapped = isTapped(sq.id);
                  const order = tapOrder(sq.id);
                  const activeColor = hslToCss(sq.color);

                  return (
                    <button
                      key={sq.id}
                      id={`echo-answer-square-${sq.id}`}
                      onClick={() => handleSquareTap(sq.id)}
                      className={`aspect-square w-full rounded-xl border transition-all duration-100 flex items-center justify-center relative cursor-pointer focus:outline-none ${
                        hasBeenTapped
                          ? "bg-mist-gray border-carbon-black scale-95"
                          : "bg-paper-white border-ash hover:bg-mist-gray/40 active:scale-95"
                      }`}
                      aria-label={`Sequence square ${sq.id + 1}`}
                    >
                      {/* Inner circle */}
                      <div className="w-8 h-8 rounded-full bg-mist-gray/40 flex items-center justify-center">
                        <div 
                          className="w-3.5 h-3.5 rounded-full transition-all duration-100 flex items-center justify-center"
                          style={{
                            backgroundColor: hasBeenTapped ? activeColor : "transparent",
                          }}
                        >
                          {hasBeenTapped && (
                            <span className="text-[10px] font-mono font-black text-carbon-black select-none">
                              {order}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center w-full animate-fade-in">
            
            {/* Visual Panel feedback */}
            <div className="w-full max-w-sm p-6 mb-6 rounded-[32px] border border-ash/40 bg-paper-white flex flex-col items-center text-center">
              
              {/* Dual feedback lamps */}
              <div className="flex justify-center gap-12 mb-4">
                <div className="flex flex-col items-center gap-1.5">
                  <div 
                    className={`w-6 h-6 rounded-full transition-all duration-300 ${
                      roundData.isCorrect 
                        ? "bg-mint-chip border-2 border-carbon-black" 
                        : "bg-mist-gray border border-ash"
                    }`}
                  />
                  <span className="text-[9px] tracking-widest text-smoke font-mono font-bold">MATCH</span>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div 
                    className={`w-6 h-6 rounded-full transition-all duration-300 ${
                      !roundData.isCorrect 
                        ? "bg-carbon-black border-2 border-carbon-black" 
                        : "bg-mist-gray border border-ash"
                    }`}
                  />
                  <span className="text-[9px] tracking-widest text-smoke font-mono font-bold">ERROR</span>
                </div>
              </div>

              {/* Simple human-friendly text */}
              <h3 className="text-2xl font-extrabold tracking-tight font-display text-carbon-black uppercase leading-none mb-2">
                {roundData.isCorrect ? "Perfect Memory!" : "Pattern Missed"}
              </h3>
              <p className="text-xs text-smoke font-mono uppercase tracking-wider">
                {roundData.isCorrect ? "You echoed the system rhythm perfectly." : "Observe the correct sequence playback:"}
              </p>
            </div>

            {/* Replay Sequence Panel */}
            <div className="p-8 bg-paper-white rounded-[32px] border border-ash/40 w-full max-w-sm">
              <div className="grid grid-cols-4 gap-4">
                {roundData.squares.map((sq) => {
                  const isReplaying = replayIndex === sq.id;
                  const wasTapped = roundData.userTaps.includes(sq.id);
                  const activeColor = hslToCss(sq.color);
                  
                  let borderStyle = "border-ash";
                  if (isReplaying) {
                    borderStyle = "border-carbon-black border-2 scale-95";
                  }

                  return (
                    <div
                      key={sq.id}
                      id={`echo-reveal-square-${sq.id}`}
                      className={`aspect-square w-full rounded-xl border transition-all duration-150 flex items-center justify-center relative ${borderStyle} bg-paper-white`}
                    >
                      <div className="w-8 h-8 rounded-full bg-mist-gray/40 flex items-center justify-center">
                        <div 
                          className="w-3.5 h-3.5 rounded-full transition-all duration-100 flex items-center justify-center"
                          style={{
                            backgroundColor: (isReplaying || wasTapped) ? activeColor : "transparent",
                          }}
                        >
                          {isReplaying && (
                            <span className="text-[10px] font-mono font-black text-carbon-black select-none">
                              ★
                            </span>
                          )}
                        </div>
                      </div>
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
          id="echo-back-btn"
          onClick={onBack}
          className="text-[10px] tracking-widest font-mono font-bold text-smoke hover:text-carbon-black transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
        >
          ← EXIT MODULE
        </button>

        {stage === "reveal" && (
          <button 
            id="echo-next-btn"
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
