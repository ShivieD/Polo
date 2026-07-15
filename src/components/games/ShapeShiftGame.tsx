/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ShapeShiftRoundData } from "../../types";
import { setupShapeShiftRound } from "../../utils/shapeLogic";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, NextIn, Btn, Loader, Wobble } from "../ui/Kit";
import { ShapeShiftGlyph, ShapeSvg } from "../ui/ShapeGlyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

type Stage = "getReady" | "countdown" | "stimulus" | "interstitial" | "answer" | "reveal";

const CHANGE_LABEL: Record<string, string> = {
  rotation: "tilted",
  size: "resized",
  radius: "re-cornered",
};

/* Spot the Shift — the Shapes-mode parallel of Spot the Difference. Four
   identical shapes, a blink, and one comes back changed in rotation, size
   or corner radius (never hue — there is none). The level schedule shrinks
   the change. Purely greyscale. */
export const ShapeShiftGame: React.FC<GameProps> = ({ onBack, onResult, streak }) => {
  const [level, setLevel] = useState(1);
  const [stage, setStage] = useState<Stage>("getReady");
  const [roundData, setRoundData] = useState<ShapeShiftRoundData>(() => setupShapeShiftRound(1));
  const [round, setRound] = useState(1);
  const [countdown, setCountdown] = useState<number>(5);
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
    setRoundData(setupShapeShiftRound(nextLevel));
    setRound((r) => r + 1);
    setStage("countdown");
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

  const isUserCorrect = roundData.userSelection === roundData.changedIndex;

  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();

      const interval = setInterval(() => setCountdown((p) => Math.max(0, p - 1)), 1000);
      const timer = setTimeout(handleNextRound, 5000);
      autoAdvanceTimer.current = timer as unknown as number;

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [stage]);

  const handleSelect = (idx: number) => {
    if (stage !== "answer") return;
    playTick();
    triggerHaptic();
    onResult?.(idx === roundData.changedIndex); // record the result once, at answer time
    setRoundData((prev) => ({ ...prev, userSelection: idx }));
    setStage("reveal");
  };

  const status =
    stage === "stimulus" ? "Memorize all four" :
    stage === "interstitial" ? "Shuffling" :
    stage === "answer" ? "Which one changed?" :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Round ${String(round).padStart(2, "0")}`;

  const specAt = (idx: number, after: boolean) =>
    after && idx === roundData.changedIndex ? roundData.changedSpec : roundData.baseSpec;

  /* A row of four cells; `after` swaps in the changed spec */
  const shapeRow = (after: boolean, interactive: boolean, idPrefix: string) => (
    <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
      {[0, 1, 2, 3].map((idx) =>
        interactive ? (
          <button
            key={idx}
            id={`${idPrefix}-${idx}`}
            onClick={() => handleSelect(idx)}
            className="cell-pop aspect-square w-full rounded-2xl border-[1.5px] border-line bg-paper p-2 cursor-pointer"
            aria-label={`Shape ${idx + 1}`}
          >
            <ShapeSvg spec={specAt(idx, after)} />
          </button>
        ) : (
          <motion.div
            key={idx}
            id={`${idPrefix}-${idx}`}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.07, type: "spring", stiffness: 400, damping: 20 }}
            className="aspect-square w-full rounded-2xl border-[1.5px] border-line bg-paper p-2"
          >
            <ShapeSvg spec={specAt(idx, after)} />
          </motion.div>
        )
      )}
    </div>
  );

  return (
    <div id="shapeshift-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Spot the Shift" status={status} onBack={onBack} streak={streak} mono level={level} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Spot the Shift"
            steps={[
              "Memorize four identical shapes — you get two seconds.",
              "We shuffle the shutter, and one comes back slightly changed: tilted, resized, or re-cornered.",
              "Tap the one that changed. The change shrinks every round.",
            ]}
            glyph={<span className="scale-150 inline-block"><ShapeShiftGlyph /></span>}
            onComplete={() => setStage("stimulus")}
            mono
          />
        )}

        {stage === "countdown" && <Countdown onComplete={() => setStage("stimulus")} mono />}

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
            {shapeRow(false, false, "shapeshift-stimulus")}
          </motion.div>
        )}

        {stage === "interstitial" && (
          <div className="flex flex-col items-center py-10">
            <Loader label="Shuffling" mono />
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center gap-7">
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-ink">
              Tap the shape that changed
            </span>
            {shapeRow(true, true, "shapeshift-answer")}
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-7">
            <VerdictHead
              id="shapeshift-reveal-verdict"
              ok={isUserCorrect}
              headline={isUserCorrect ? "Shift detected." : "It slipped past."}
              mono
            />

            <Wobble active={!isUserCorrect} className="w-full max-w-sm">
              {/* Before and after — the changed shape wears the solid ink
                  outline, a wrong pick the thin dashed mid-grey one */}
              <div className="flex flex-col gap-6 w-full">
                {(["Before", "After"] as const).map((label) => {
                  const after = label === "After";
                  return (
                    <div key={label}>
                      <div className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut mb-2.5">
                        {label}
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        {[0, 1, 2, 3].map((idx) => {
                          const isChanged = roundData.changedIndex === idx;
                          const isSelected = after && roundData.userSelection === idx;
                          return (
                            <div key={idx} className="flex flex-col items-center gap-1.5">
                              <div
                                id={`shapeshift-reveal-${label.toLowerCase()}-${idx}`}
                                className={`aspect-square w-full rounded-2xl bg-paper p-2 ${
                                  isChanged
                                    ? "border-[3px] border-ink"
                                    : isSelected
                                      ? "border-2 border-dashed border-mut"
                                      : "border-[1.5px] border-line"
                                }`}
                              >
                                <ShapeSvg spec={specAt(idx, after)} />
                              </div>
                              <span className="h-5 flex items-center">
                                {isChanged && (
                                  <span className="font-mono font-extrabold text-[9.5px] tracking-[0.1em] uppercase text-mut">
                                    {after ? "Correct" : "Was"}
                                  </span>
                                )}
                                {isSelected && !isChanged && (
                                  <span className="font-mono font-extrabold text-[9.5px] tracking-[0.1em] uppercase text-mut border border-dashed border-mut rounded-full px-2 py-0.5">
                                    Your
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Wobble>

            <VerdictBody
              detail={
                isUserCorrect
                  ? `Dead on — it was ${CHANGE_LABEL[roundData.changeKind]}. Compare before and after to see the drift.`
                  : `The shape in the solid outline was ${CHANGE_LABEL[roundData.changeKind]}. Compare before and after.`
              }
            />

            <div className="flex flex-col items-center gap-4">
              <Btn id="shapeshift-next-btn" variant="secondary" onClick={handleNextRound}>Next four</Btn>
              <NextIn seconds={countdown} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
