/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { playTick, triggerHaptic } from "../utils/audio";

interface GetReadyProps {
  name: string;
  instructions: string;
  accentColor: string;
  onComplete: () => void;
}

export const GetReady: React.FC<GetReadyProps> = ({ 
  name, 
  instructions, 
  accentColor, 
  onComplete 
}) => {
  const [isStarting, setIsStarting] = useState(false);
  const [countdown, setCountdown] = useState(100); // Visual progress bar %

  const handleStart = () => {
    playTick();
    triggerHaptic();
    setIsStarting(true);
    
    // Smooth progress fill over 1 second, then trigger onComplete
    const duration = 1000;
    const start = performance.now();
    
    const animate = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setCountdown(100 - pct);
      
      if (elapsed < duration) {
        requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };
    
    requestAnimationFrame(animate);
  };

  return (
    <div 
      id="get-ready-view" 
      className="flex flex-col items-center justify-between min-h-[360px] p-8 text-center select-none bg-paper-white rounded-[32px] w-full max-w-md mx-auto"
    >
      <div className="my-auto max-w-sm px-4 flex flex-col items-center">
        {/* Monoline Icon indicator */}
        <div className="w-12 h-12 rounded-full bg-mist-gray border border-ash flex items-center justify-center mb-6">
          <div className="w-4 h-4 bg-carbon-black rounded-full" />
        </div>

        {/* Game Title */}
        <h2 className="text-3xl font-extrabold tracking-tight font-display text-carbon-black mb-3 uppercase leading-none">
          {name}
        </h2>
        
        {/* Instruction block in clear contrast */}
        <p className="text-sm text-slate font-medium leading-relaxed max-w-xs">
          {instructions}
        </p>
      </div>

      <div className="w-full flex flex-col items-center gap-6 mt-6">
        {!isStarting ? (
          <button
            id="get-ready-start-btn"
            onClick={handleStart}
            className="group px-8 py-3.5 font-mono text-[11px] uppercase tracking-widest font-black transition-all duration-150 cursor-pointer rounded-lg bg-carbon-black text-paper-white hover:bg-carbon-black/95 active:scale-95 focus:outline-none flex items-center gap-2"
          >
            {/* Tiny Voltage Yellow LED inside button */}
            <span 
              className="w-2 h-2 rounded-full bg-voltage-yellow transition-all duration-300"
            />
            <span>ACTIVATE MODULE</span>
          </button>
        ) : (
          <div className="flex flex-col items-center w-full max-w-xs gap-3">
            <span className="text-[10px] tracking-widest text-smoke font-mono uppercase animate-pulse">
              CALIBRATING SYSTEM...
            </span>
            
            {/* Visual progress track */}
            <div className="w-full h-2 bg-mist-gray rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-[16ms] ease-linear"
                style={{ width: `${100 - countdown}%`, backgroundColor: accentColor }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
