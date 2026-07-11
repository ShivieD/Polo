/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ShiftRoundData } from "../../types";
import { setupShiftRound } from "../../utils/gameLogic";
import { hslToCss } from "../../utils/color";
import { GameHead, Ready, Verdict, Btn, Loader, Wobble } from "../ui/Kit";
import { ShiftGlyph } from "../ui/Glyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onPlayed?: () => void;
}

type ShiftStage = "getReady" | "stimulus" | "interstitial" | "answer" | "reveal";

export const ShiftGame: React.FC<GameProps> = ({ onBack, onPlayed }) => {
  const [stage, setStage] = useState<ShiftStage>("getReady");
  const [roundData, setRoundData] = useState<ShiftRoundData>(() => setupShiftRound());
  const [round, setRound] = useState(1);
  const [countdown, setCountdown] = useState<number>(5);
  const autoAdvanceTimer = useRef<number | null>(null);

  const handleNextRound = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setRoundData(setupShiftRound());
    setRound((r) => r + 1);
    setStage("getReady");
    setCountdown(5);
  };

  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => setStage("interstitial"), 2000);
      return () => clearTimeout(timer);
    }
    if (stage === "interstitial") {
      const timer = setTimeout(() => setStage("answer"), 700);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();
      onPlayed?.();

      const interval = setInterval(() => setCountdown((p) => Math.max(0, p - 1)), 1000);
      const timer = setTimeout(handleNextRound, 5000);
      autoAdvanceTimer.current = timer as unknown as number;

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
    setRoundData((prev) => ({ ...prev, userSelection: idx }));
    setStage("reveal");
  };

  const isUserCorrect = roundData.userSelection === roundData.shiftedIndex;

  const status =
    stage === "stimulus" ? "Memorize all four" :
    stage === "interstitial" ? "Shuffling" :
    stage === "answer" ? "Which one changed?" :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Round ${String(round).padStart(2, "0")}`;

  const blockGrid = (
    colors: typeof roundData.originalColors,
    render: (idx: number) => React.ReactNode
  ) => (
    <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
      {colors.map((_, idx) => render(idx))}
    </div>
  );

  return (
    <div id="shift-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Spot the Difference" status={status} onBack={onBack} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Spot the Difference"
            instructions="Four color blocks, two seconds. We shuffle the shutter, and one block comes back slightly off. Tap the one that drifted."
            glyph={<span className="scale-150 inline-block"><ShiftGlyph /></span>}
            onComplete={() => setStage("stimulus")}
          />
        )}

        {stage === "stimulus" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="flex flex-col items-center gap-6"
          >
            <span className="font-mono font-extrabold text-[11px] tracking-[0.18em] uppercase text-mut">
              Memorize all four
            </span>
            {blockGrid(roundData.originalColors, (idx) => (
              <motion.div
                key={idx}
                id={`shift-stimulus-square-${idx}`}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.07, type: "spring", stiffness: 400, damping: 20 }}
                className="aspect-square w-full rounded-2xl"
                style={{ backgroundColor: hslToCss(roundData.originalColors[idx]) }}
              />
            ))}
          </motion.div>
        )}

        {stage === "interstitial" && (
          <div className="flex flex-col items-center py-10">
            <Loader label="Shuffling" />
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center gap-7">
            <span className="font-mono font-extrabold text-[11px] tracking-[0.18em] uppercase text-ink">
              Tap the block that changed
            </span>
            {blockGrid(roundData.shiftedColors, (idx) => (
              <button
                key={idx}
                id={`shift-answer-square-${idx}`}
                onClick={() => handleSelectSquare(idx)}
                className="cell-pop aspect-square w-full rounded-2xl cursor-pointer"
                style={{ backgroundColor: hslToCss(roundData.shiftedColors[idx]) }}
                aria-label={`Block ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-9">
            <Wobble active={!isUserCorrect} className="w-full max-w-sm">
              <div className="flex flex-col gap-7 w-full">
                {/* Before row — shown on a miss so the delta is obvious */}
                {!isUserCorrect && (
                  <div>
                    <div className="font-mono font-extrabold text-[10px] tracking-[0.16em] uppercase text-mut mb-2.5">
                      Before
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {roundData.originalColors.map((color, idx) => (
                        <div
                          key={idx}
                          id={`shift-original-reveal-square-${idx}`}
                          className={`aspect-square w-full rounded-2xl relative ${
                            roundData.shiftedIndex === idx ? "" : "opacity-40"
                          }`}
                          style={{ backgroundColor: hslToCss(color) }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  {!isUserCorrect && (
                    <div className="font-mono font-extrabold text-[10px] tracking-[0.16em] uppercase text-mut mb-2.5">
                      After
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-3">
                    {roundData.shiftedColors.map((color, idx) => {
                      const isShifted = roundData.shiftedIndex === idx;
                      const isSelected = roundData.userSelection === idx;
                      return (
                        <div
                          key={idx}
                          id={`shift-reveal-square-${idx}`}
                          className={`aspect-square w-full rounded-2xl relative ${
                            isShifted
                              ? "ring-[3px] ring-ink ring-offset-2 ring-offset-paper"
                              : isSelected
                                ? "ring-2 ring-play-red ring-offset-2 ring-offset-paper"
                                : isUserCorrect
                                  ? "opacity-45"
                                  : "opacity-40"
                          }`}
                          style={{ backgroundColor: hslToCss(color) }}
                        >
                          {isShifted && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 font-mono font-extrabold text-[9px] tracking-[0.1em] uppercase bg-play-green text-paper rounded-full px-2 py-0.5">
                              It
                            </span>
                          )}
                          {isSelected && !isShifted && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 font-mono font-extrabold text-[9px] tracking-[0.1em] uppercase bg-ink text-paper rounded-full px-2 py-0.5">
                              You
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Wobble>

            <Verdict
              id="shift-reveal-verdict"
              ok={isUserCorrect}
              headline={isUserCorrect ? "Drift detected." : "It slipped past."}
              detail={
                isUserCorrect
                  ? "You caught the shifted block dead on."
                  : "Compare before and after — the drifted block is ringed in ink."
              }
              nextIn={countdown}
            />

            <Btn id="shift-next-btn" variant="secondary" onClick={handleNextRound}>Next grid</Btn>
          </div>
        )}
      </div>
    </div>
  );
};
