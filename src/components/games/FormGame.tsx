/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { FormRoundData } from "../../types";
import { setupFormRound, FORM_EXPOSURE_MS } from "../../utils/shapeLogic";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, NextIn, Btn, Wobble } from "../ui/Kit";
import { FormGlyph, ShapeSvg } from "../ui/ShapeGlyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

/* Shape Match — the Shapes-mode parallel of Color Match. One silhouette,
   two seconds, then six near-identical impostors. The level schedule
   tightens distractor similarity: families → neighbors → aspect → weight
   → 10% → 5% variations. Purely greyscale. */
export const FormGame: React.FC<GameProps> = ({ onBack, onResult, streak }) => {
  const [level, setLevel] = useState(1);
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<FormRoundData>(() => setupFormRound(1));
  const [round, setRound] = useState(1);
  const [countdown, setCountdown] = useState<number>(4);
  const autoAdvanceTimer = useRef<number | null>(null);

  /* Fixed schedule: every round climbs one rung, capped at L6, and a wrong
     answer never rolls it back. Next run goes straight to the countdown. */
  const handleNextRound = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    const nextLevel = Math.min(6, level + 1);
    setLevel(nextLevel);
    setRoundData(setupFormRound(nextLevel));
    setRound((r) => r + 1);
    setStage("countdown");
    setCountdown(4);
  };

  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => setStage("answer"), FORM_EXPOSURE_MS);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  const correctIdx = roundData.options.findIndex((o) => o.isCorrect);
  const isUserCorrect = roundData.userSelection === correctIdx;

  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();

      const interval = setInterval(() => setCountdown((p) => Math.max(0, p - 1)), 1000);
      const timer = setTimeout(handleNextRound, 4000);
      autoAdvanceTimer.current = timer as unknown as number;

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [stage]);

  const handleSelectOption = (idx: number) => {
    if (stage !== "answer") return;
    playTick();
    triggerHaptic();
    onResult?.(idx === correctIdx); // record the result once, at answer time
    setRoundData((prev) => ({ ...prev, userSelection: idx }));
    setStage("reveal");
  };

  const status =
    stage === "stimulus" ? "Memorize it" :
    stage === "answer" ? "Which one was it?" :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Round ${String(round).padStart(2, "0")}`;

  return (
    <div id="form-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Shape Match" status={status} onBack={onBack} streak={streak} mono level={level} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Shape Match"
            steps={[
              "Memorize one shape — you get two seconds.",
              "It hides among five near-identical impostors.",
              "Tap the exact shape you saw. Every round the impostors get closer.",
            ]}
            glyph={<span className="scale-150 inline-block"><FormGlyph /></span>}
            onComplete={() => setStage("stimulus")}
            mono
          />
        )}

        {stage === "countdown" && <Countdown onComplete={() => setStage("stimulus")} mono />}

        {stage === "stimulus" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
            className="flex flex-col items-center gap-6"
          >
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-mut">
              Memorize this shape
            </span>
            <div
              id="form-stimulus-box"
              className="w-52 h-52 sm:w-60 sm:h-60 rounded-3xl border-[1.5px] border-line bg-paper p-6"
            >
              <ShapeSvg spec={roundData.target} />
            </div>
          </motion.div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center gap-7">
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-ink">
              Tap the exact match
            </span>
            <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
              {roundData.options.map((opt, idx) => (
                <motion.button
                  key={idx}
                  id={`form-option-${idx}`}
                  onClick={() => handleSelectOption(idx)}
                  initial={{ opacity: 0, y: 18, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: idx * 0.05, type: "spring", stiffness: 380, damping: 20 }}
                  className="cell-pop aspect-square w-full rounded-2xl border-[1.5px] border-line bg-paper p-3 cursor-pointer"
                  aria-label={`Shape option ${idx + 1}`}
                >
                  <ShapeSvg spec={opt.spec} />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-7">
            <VerdictHead
              id="form-reveal-verdict"
              ok={isUserCorrect}
              headline={isUserCorrect ? "Spot on." : "An impostor got you."}
              mono
            />

            <Wobble active={!isUserCorrect} className="w-full max-w-sm flex justify-center">
              {/* Truth revealed alongside the guess — solid ink outline for
                  the correct shape, thin dashed mid-grey for a wrong pick */}
              <div className="grid grid-cols-3 gap-3 w-full">
                {roundData.options.map((opt, idx) => {
                  const isSelected = roundData.userSelection === idx;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1.5">
                      <div
                        id={`form-reveal-option-${idx}`}
                        className={`aspect-square w-full rounded-2xl bg-paper p-3 ${
                          opt.isCorrect
                            ? "border-[3px] border-ink"
                            : isSelected
                              ? "border-2 border-dashed border-mut"
                              : "border-[1.5px] border-line"
                        }`}
                      >
                        <ShapeSvg spec={opt.spec} />
                      </div>
                      <span className="h-5 flex items-center">
                        {opt.isCorrect && (
                          <span className="font-mono font-extrabold text-[9.5px] tracking-[0.1em] uppercase bg-ink text-paper rounded-full px-2 py-0.5">
                            Correct
                          </span>
                        )}
                        {isSelected && !opt.isCorrect && (
                          <span className="font-mono font-extrabold text-[9.5px] tracking-[0.1em] uppercase text-mut border border-dashed border-mut rounded-full px-2 py-0.5">
                            Your
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Wobble>

            <VerdictBody
              detail={
                isUserCorrect
                  ? "You picked the exact specimen from the lineup."
                  : "The correct shape wears the solid ink outline — compare it against your pick."
              }
            />

            <div className="flex flex-col items-center gap-4">
              <Btn id="form-next-btn" variant="secondary" onClick={handleNextRound}>Next shape</Btn>
              <NextIn seconds={countdown} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
