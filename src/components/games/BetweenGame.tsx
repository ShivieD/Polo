/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { BetweenRoundData } from "../../types";
import { setupBetweenRound, interpolateHsl } from "../../utils/gameLogic";
import { hslToCss } from "../../utils/color";
import { GetReady } from "../GetReady";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
}

export const BetweenGame: React.FC<GameProps> = ({ accentColor, onBack }) => {
  const [stage, setStage] = useState<"getReady" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<BetweenRoundData>(() => setupBetweenRound());
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(4);
  const isDragging = useRef(false);

  // Restart/Next Round
  const handleNextRound = () => {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      setAutoAdvanceTimer(null);
    }
    setRoundData(setupBetweenRound());
    setStage("getReady");
    setCountdown(4);
  };

  // Stimulus timer
  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => {
        setStage("answer");
      }, 2000); // 2 seconds exposure
      return () => clearTimeout(timer);
    }
  }, [stage]);

  // Auto-advance on reveal
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

  // Handle click/drag to position on the empty bar
  const updatePosition = (clientX: number) => {
    const bar = document.getElementById("between-empty-bar");
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    
    setRoundData((prev) => ({
      ...prev,
      guessPosition: fraction,
    }));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stage !== "answer") return;
    isDragging.current = true;
    updatePosition(e.clientX);
    
    // Set pointer capture to receive moves outside elements
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || stage !== "answer") return;
    updatePosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    playTick();
    triggerHaptic();
  };

  const handleDone = () => {
    if (stage !== "answer") return;

    playTick();
    triggerHaptic();

    const score = Math.round(100 * (1 - Math.abs(roundData.guessPosition - roundData.truePosition)));
    setRoundData((prev) => ({
      ...prev,
      score,
    }));
    setStage("reveal");
  };

  // Get current interpolated target color
  const targetColor = interpolateHsl(roundData.colorStart, roundData.colorEnd, roundData.truePosition);
  
  // Create a multi-stop HSL-interpolated gradient to perfectly match our HSL shorter-hue math in CSS
  const gradientStops = Array.from({ length: 21 }, (_, i) => {
    const fraction = i / 20;
    const interpolated = interpolateHsl(roundData.colorStart, roundData.colorEnd, fraction);
    return hslToCss(interpolated);
  });
  const gradientStyle = `linear-gradient(to right, ${gradientStops.join(", ")})`;

  const score = roundData.score || 0;
  const isPerfect = score >= 90;
  const isGood = score >= 70 && score < 90;
  const isPoor = score < 70;

  return (
    <div id="between-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto px-2 justify-between min-h-[480px]">
      
      {/* Top status bar */}
      <div className="flex justify-between items-center text-xs tracking-wider text-smoke font-mono select-none mb-6 pb-3 border-b border-ash uppercase">
        <span className="font-bold">MODULE 04: GRADIENT POSITION</span>
        {stage === "reveal" && (
          <span className="text-carbon-black font-bold">NEXT IN {countdown}s</span>
        )}
        {stage === "stimulus" && (
          <span className="text-slate font-bold animate-pulse">MEMORIZE GRADIENT SPAN...</span>
        )}
        {stage === "answer" && (
          <span className="text-carbon-black font-bold">LOCATE SWATCH ORIGIN</span>
        )}
      </div>

      {/* Main board */}
      <div className="flex-1 flex flex-col justify-center py-4">
        {stage === "getReady" && (
          <GetReady 
            name="Find the Spot" 
            instructions="Look at the full gradient bar. We will hide it, show you a single color block, and then you slide the needle to where that block belongs on the scale." 
            accentColor={accentColor} 
            onComplete={() => setStage("stimulus")} 
          />
        )}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center justify-center py-6">
            <h3 className="text-xs font-mono tracking-widest text-smoke uppercase mb-6 text-center font-bold">
              MEMORIZING GRADIENT SPECTRUM
            </h3>

            {/* Premium Gradient bar */}
            <div className="p-4 bg-paper-white border border-ash/40 rounded-2xl w-full max-w-md">
              <div 
                id="between-gradient-bar"
                className="w-full h-24 rounded-lg border border-ash"
                style={{ background: gradientStyle }}
              />
            </div>

            {/* Amber beacon */}
            <div className="flex items-center gap-2 mt-8">
              <span className="w-2.5 h-2.5 rounded-full bg-voltage-yellow border border-carbon-black" />
              <span className="text-[10px] font-mono tracking-widest text-smoke uppercase font-bold">
                OBSERVATION FREQUENCY OPEN
              </span>
            </div>
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center w-full">
            
            {/* Color block viewport */}
            <div className="p-4 bg-paper-white border border-ash/40 rounded-[32px] mb-6 flex flex-col items-center">
              <div 
                id="between-target-swatch"
                className="w-32 h-32 rounded-2xl border border-ash/40"
                style={{ backgroundColor: hslToCss(targetColor) }}
              />
              <div className="text-center font-mono text-[9px] text-smoke font-bold tracking-widest uppercase mt-3">
                TARGET SPECIMEN
              </div>
            </div>

            <p className="text-xs font-bold tracking-tight text-carbon-black uppercase mb-4 text-center">
              Slide the pointer below to where this color fits best:
            </p>

            {/* Flat Brutalist dial tuner */}
            <div className="w-full max-w-md bg-paper-white p-6 rounded-[32px] border border-ash/40">
              <div className="w-full relative pb-4 select-none">
                
                {/* Horizontal Tick marks */}
                <div className="flex justify-between px-1 mb-3 h-3 text-[8px] font-mono text-smoke select-none font-bold">
                  {[...Array(11)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className={`w-[1px] bg-ash ${i % 5 === 0 ? "h-3 bg-smoke" : "h-1.5"}`} />
                      {i % 5 === 0 && <span>{i * 10}</span>}
                    </div>
                  ))}
                </div>

                <div 
                  id="between-empty-bar"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="w-full h-8 bg-mist-gray border border-ash cursor-ew-resize relative flex items-center rounded-lg"
                >
                  {/* Flat Track pointer */}
                  <div 
                    className="absolute w-[3px] h-full bg-carbon-black flex items-center justify-center z-10"
                    style={{ left: `${roundData.guessPosition * 100}%`, transform: "translateX(-50%)" }}
                  >
                    {/* Flat round handle */}
                    <div className="w-4 h-4 bg-carbon-black border-2 border-paper-white rounded-full absolute -top-3 shadow-sm" />
                  </div>
                </div>

                <div className="flex justify-between font-mono text-[9px] text-smoke uppercase font-bold mt-2">
                  <span>STARTING REGION</span>
                  <span>ENDING REGION</span>
                </div>
              </div>
            </div>

            <button
              id="between-done-btn"
              onClick={handleDone}
              className="mt-6 px-8 py-3 font-mono text-xs uppercase tracking-widest font-black transition-all duration-150 cursor-pointer rounded-lg bg-carbon-black text-paper-white hover:bg-carbon-black/95 active:scale-95 focus:outline-none flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-voltage-yellow" />
              <span>LOCK ALIGNMENT</span>
            </button>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center w-full select-none animate-fade-in">
            {/* Color block viewport */}
            <div className="p-4 bg-paper-white border border-ash/40 rounded-[32px] mb-6 flex flex-col items-center">
              <div 
                id="between-reveal-swatch"
                className="w-24 h-24 rounded-2xl border border-ash/40"
                style={{ backgroundColor: hslToCss(targetColor) }}
              />
            </div>

            {/* True gradient with markers */}
            <div className="w-full max-w-md bg-paper-white p-6 rounded-[32px] border border-ash/40 mb-6">
              <div className="w-full relative h-14 rounded-lg border border-ash" style={{ background: gradientStyle }}>
                
                {/* True position line */}
                <div 
                  id="between-marker-true"
                  className="absolute h-full w-[4px] bg-carbon-black"
                  style={{ 
                    left: `${roundData.truePosition * 100}%`, 
                    transform: "translateX(-50%)",
                    zIndex: 20,
                  }}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-mono font-black tracking-widest text-paper-white px-2 py-0.5 bg-carbon-black rounded uppercase">
                    TRUE
                  </div>
                </div>

                {/* Guess position line */}
                <div 
                  id="between-marker-guess"
                  className="absolute h-full w-[3px] bg-smoke"
                  style={{ 
                    left: `${roundData.guessPosition * 100}%`, 
                    transform: "translateX(-50%)",
                    zIndex: 10,
                  }}
                >
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[9px] font-mono font-black tracking-widest text-carbon-black px-2 py-0.5 bg-voltage-yellow rounded border border-carbon-black uppercase">
                    GUESSED
                  </div>
                </div>
              </div>
            </div>

            {/* Scorecard panel */}
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
              <div id="between-reveal-score" className="text-4xl font-extrabold tracking-tight font-display text-carbon-black uppercase">
                {roundData.score}% MATCH
              </div>

              <div className="text-xs text-slate font-medium mt-3 text-center leading-relaxed">
                {isPerfect ? "Incredible spatial vision! Absolute alignment." : isGood ? "Great estimation! Outstanding accuracy." : "A bit off center. Keep refining your sight!"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="h-16 flex items-center justify-between select-none border-t border-ash mt-6 pt-2">
        <button 
          id="between-back-btn"
          onClick={onBack}
          className="text-[10px] tracking-widest font-mono font-bold text-smoke hover:text-carbon-black transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
        >
          ← EXIT MODULE
        </button>

        {stage === "reveal" && (
          <button 
            id="between-next-btn"
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
