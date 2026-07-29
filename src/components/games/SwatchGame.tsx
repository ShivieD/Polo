/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { SwatchRoundData } from "../../types";
import { setupSwatchRound } from "../../utils/gameLogic";
import { hslToCss, HSL } from "../../utils/color";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, Btn, Wobble } from "../ui/Kit";
import { useProgression, LivesBar, RunTimer, OutcomeNote } from "../ui/Progress";
import { RunOutcome } from "../../utils/progression";
import { SwatchGlyph } from "../ui/Glyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

export const SwatchGame: React.FC<GameProps> = ({ onBack, onResult, accentColor }) => {
  const prog = useProgression("swatch");
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<SwatchRoundData>(() => setupSwatchRound(prog.ramp));
  const [round, setRound] = useState(1);
  const [lastOutcome, setLastOutcome] = useState<RunOutcome | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  /* Next run waits for the CTA — no auto-advance */
  const handleNextRound = () => {
    setTimedOut(false);
    setRoundData(setupSwatchRound(prog.ramp));
    setRound((r) => r + 1);
    setStage("countdown");
  };

  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => setStage("answer"), 2000);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  const correct = roundData.options.find((o) => o.isCorrect)?.color;
  const isUserCorrect =
    !!roundData.userSelection &&
    !!correct &&
    correct.h === roundData.userSelection.h &&
    correct.s === roundData.userSelection.s &&
    correct.l === roundData.userSelection.l;

  useEffect(() => {
    if (stage === "reveal") playRevealInterval();
  }, [stage]);

  const handleSelectOption = (option: { color: HSL; isCorrect: boolean }) => {
    if (stage !== "answer") return;
    playTick();
    triggerHaptic();
    onResult?.(option.isCorrect); // record the result once, at answer time
    setLastOutcome(prog.report(option.isCorrect, option.isCorrect ? 100 : 0));
    setRoundData((prev) => ({ ...prev, userSelection: option.color }));
    setStage("reveal");
  };

  /* Clock ran out with no pick — counts as a miss */
  const handleTimeout = () => {
    if (stage !== "answer") return;
    triggerHaptic();
    onResult?.(false);
    setTimedOut(true);
    setLastOutcome(prog.report(false, 0));
    setStage("reveal");
  };

  return (
    <div id="swatch-game-container" className="w-full flex flex-col flex-1 max-w-3xl mx-auto">
      <GameHead
        title="Color Match"
        onBack={onBack}
        streak={prog.streak}
        points={prog.points}
        lives={<LivesBar lives={prog.lives} />}
        onReset={prog.requestReset}
        gameId="swatch"
        accent={accentColor}
      />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Color Match"
            steps={[
              "Memorize one color — you get two seconds.",
              "It hides among near-identical impostors — every level adds one more.",
              "Tap the exact color before the clock runs out. Clean-pass all 5 runs to level up.",
            ]}
            glyph={<span className="scale-150 inline-block"><SwatchGlyph /></span>}
            onComplete={() => setStage("stimulus")}
            accentColor={accentColor}
          />
        )}

        {stage === "countdown" && <Countdown onComplete={() => setStage("stimulus")} />}

        {stage === "stimulus" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
            className="flex flex-col items-center gap-6"
          >
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-mut">
              Memorize this color
            </span>
            <div
              id="swatch-stimulus-box"
              className="w-52 h-52 sm:w-60 sm:h-60 rounded-3xl border-[1.5px] border-line"
              style={{ backgroundColor: hslToCss(roundData.targetColor) }}
            />
          </motion.div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center gap-7">
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-ink">
              Tap the exact match
            </span>
            {prog.timerSeconds !== null && (
              <RunTimer
                id="swatch-run-timer"
                seconds={prog.timerSeconds}
                running={stage === "answer"}
                runKey={round}
                onExpire={handleTimeout}
              />
            )}
            <div className="grid grid-cols-6 gap-3 w-full max-w-2xl">
              {roundData.options.map((opt, idx) => (
                <motion.button
                  key={idx}
                  id={`swatch-option-${idx}`}
                  onClick={() => handleSelectOption(opt)}
                  initial={{ opacity: 0, y: 18, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: idx * 0.05, type: "spring", stiffness: 380, damping: 20 }}
                  className="cell-pop aspect-square w-full rounded-2xl cursor-pointer"
                  style={{ backgroundColor: hslToCss(opt.color) }}
                  aria-label={`Color option ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-7">
            <VerdictHead
              id="swatch-reveal-verdict"
              ok={isUserCorrect}
              headline={isUserCorrect ? "Spot on." : timedOut ? "Time ran out." : "An impostor got you."}
            />
            <OutcomeNote outcome={lastOutcome} />

            <Wobble active={!isUserCorrect} className="w-full max-w-2xl flex justify-center">
              {/* Every color stays at full strength; tags sit BELOW the
                  swatches so they never blend into a similar color */}
              <div className="grid grid-cols-6 gap-3 w-full">
                {roundData.options.map((opt, idx) => {
                  const isSelected =
                    !!roundData.userSelection &&
                    roundData.userSelection.h === opt.color.h &&
                    roundData.userSelection.s === opt.color.s &&
                    roundData.userSelection.l === opt.color.l;

                  return (
                    <div key={idx} className="flex flex-col items-center gap-1.5">
                      <div
                        id={`swatch-reveal-option-${idx}`}
                        className={`aspect-square w-full rounded-2xl ${
                          opt.isCorrect
                            ? "ring-[3px] ring-ink ring-offset-2 ring-offset-paper"
                            : isSelected
                              ? "ring-2 ring-play-red ring-offset-2 ring-offset-paper"
                              : ""
                        }`}
                        style={{ backgroundColor: hslToCss(opt.color) }}
                      />
                      <span className="h-5 flex items-center">
                        {opt.isCorrect && (
                          <span className="font-mono font-extrabold text-[9.5px] tracking-[0.1em] uppercase bg-play-green text-paper rounded-full px-2 py-0.5">
                            Correct
                          </span>
                        )}
                        {isSelected && !opt.isCorrect && (
                          <span className="font-mono font-extrabold text-[9.5px] tracking-[0.1em] uppercase bg-ink text-paper rounded-full px-2 py-0.5">
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
                  : "The correct color is ringed in ink — compare it against your pick."
              }
            />

            <Btn id="swatch-next-btn" variant="secondary" onClick={handleNextRound}>Next color</Btn>
          </div>
        )}
      </div>
      {prog.overlays}
    </div>
  );
};
