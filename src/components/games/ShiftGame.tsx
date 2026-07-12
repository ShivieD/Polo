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
  onResult?: (correct: boolean) => void;
  streak?: number;
}

type ShiftStage = "getReady" | "stimulus" | "interstitial" | "answer" | "reveal";

export const ShiftGame: React.FC<GameProps> = ({ onBack, onResult, streak }) => {
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

  const isUserCorrect = roundData.userSelection === roundData.shiftedIndex;

  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();
      onResult?.(isUserCorrect);

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

  const status =
    stage === "stimulus" ? "Memorize all four" :
    stage === "interstitial" ? "Shuffling" :
    stage === "answer" ? "Which one changed?" :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Round ${String(round).padStart(2, "0")}`;

  return (
    <div id="shift-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Spot the Difference" status={status} onBack={onBack} streak={streak} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Spot the Difference"
            steps={[
              "Memorize four color blocks — you get two seconds.",
              "We shuffle the shutter, and one block comes back slightly off.",
              "Tap the block that changed.",
            ]}
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
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-mut">
              Memorize all four
            </span>
            <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
              {roundData.originalColors.map((color, idx) => (
                <motion.div
                  key={idx}
                  id={`shift-stimulus-square-${idx}`}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.07, type: "spring", stiffness: 400, damping: 20 }}
                  className="aspect-square w-full rounded-2xl"
                  style={{ backgroundColor: hslToCss(color) }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {stage === "interstitial" && (
          <div className="flex flex-col items-center py-10">
            <Loader label="Shuffling" />
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center gap-7">
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-ink">
              Tap the block that changed
            </span>
            <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
              {roundData.shiftedColors.map((color, idx) => (
                <button
                  key={idx}
                  id={`shift-answer-square-${idx}`}
                  onClick={() => handleSelectSquare(idx)}
                  className="cell-pop aspect-square w-full rounded-2xl cursor-pointer"
                  style={{ backgroundColor: hslToCss(color) }}
                  aria-label={`Block ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-9">
            <Wobble active={!isUserCorrect} className="w-full max-w-sm">
              {/* Both rows at full, true color — no fading. Tags live BELOW
                  the tiles so they never blend into a similar swatch. */}
              <div className="flex flex-col gap-6 w-full">
                <div>
                  <div className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut mb-2.5">
                    Before
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {roundData.originalColors.map((color, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-1.5">
                        <div
                          id={`shift-original-reveal-square-${idx}`}
                          className={`aspect-square w-full rounded-2xl ${
                            roundData.shiftedIndex === idx
                              ? "ring-[3px] ring-ink ring-offset-2 ring-offset-paper"
                              : ""
                          }`}
                          style={{ backgroundColor: hslToCss(color) }}
                        />
                        <span className="h-5 flex items-center">
                          {roundData.shiftedIndex === idx && (
                            <span className="font-mono font-extrabold text-[9.5px] tracking-[0.1em] uppercase text-mut">
                              Was
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut mb-2.5">
                    After
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {roundData.shiftedColors.map((color, idx) => {
                      const isShifted = roundData.shiftedIndex === idx;
                      const isSelected = roundData.userSelection === idx;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5">
                          <div
                            id={`shift-reveal-square-${idx}`}
                            className={`aspect-square w-full rounded-2xl ${
                              isShifted
                                ? "ring-[3px] ring-ink ring-offset-2 ring-offset-paper"
                                : isSelected
                                  ? "ring-2 ring-play-red ring-offset-2 ring-offset-paper"
                                  : ""
                            }`}
                            style={{ backgroundColor: hslToCss(color) }}
                          />
                          <span className="h-5 flex items-center">
                            {isShifted && (
                              <span className="font-mono font-extrabold text-[9.5px] tracking-[0.1em] uppercase bg-play-green text-paper rounded-full px-2 py-0.5">
                                Correct
                              </span>
                            )}
                            {isSelected && !isShifted && (
                              <span className="font-mono font-extrabold text-[9.5px] tracking-[0.1em] uppercase bg-ink text-paper rounded-full px-2 py-0.5">
                                Your
                              </span>
                            )}
                          </span>
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
                  ? "You caught the changed block dead on. Compare before and after to see the drift."
                  : "Compare before and after — the block that changed is tagged Correct."
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
