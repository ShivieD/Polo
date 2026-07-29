/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ShapeShiftRoundData } from "../../types";
import { setupShapeShiftRound } from "../../utils/shapeLogic";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, Btn, Loader, Wobble } from "../ui/Kit";
import { useProgression, LivesBar, OutcomeNote } from "../ui/Progress";
import { RunOutcome } from "../../utils/progression";
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
  swap: "swapped out for a different shape",
};

/* Spot the Shift — the Shapes-mode parallel of Spot the Difference. Four
   identical shapes, a blink, and one comes back changed in rotation, size
   or corner radius (never hue — there is none). The level schedule shrinks
   the change. Purely greyscale. */
export const ShapeShiftGame: React.FC<GameProps> = ({ onBack, onResult }) => {
  const prog = useProgression("shapeshift");
  const [stage, setStage] = useState<Stage>("getReady");
  const [roundData, setRoundData] = useState<ShapeShiftRoundData>(() => setupShapeShiftRound(prog.ramp));
  const [round, setRound] = useState(1);
  const [lastOutcome, setLastOutcome] = useState<RunOutcome | null>(null);

  /* Next run waits for the CTA — no auto-advance */
  const handleNextRound = () => {
    setRoundData(setupShapeShiftRound(prog.ramp));
    setRound((r) => r + 1);
    setStage("countdown");
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
    if (stage === "reveal") playRevealInterval();
  }, [stage]);

  const handleSelect = (idx: number) => {
    if (stage !== "answer") return;
    playTick();
    triggerHaptic();
    onResult?.(idx === roundData.changedIndex); // record the result once, at answer time
    setLastOutcome(prog.report(idx === roundData.changedIndex, idx === roundData.changedIndex ? 100 : 0));
    setRoundData((prev) => ({ ...prev, userSelection: idx }));
    setStage("reveal");
  };

  /* Uniform rounds draw every cell from baseSpec; lineup rounds give each
     cell its own shape via cellSpecs */
  const specAt = (idx: number, after: boolean) => {
    if (after && idx === roundData.changedIndex) return roundData.changedSpec;
    return roundData.cellSpecs?.[idx] ?? roundData.baseSpec;
  };

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
    <div id="shapeshift-game-container" className="w-full flex flex-col flex-1 max-w-3xl mx-auto">
      <GameHead
        title="Spot the Shift"
        onBack={onBack}
        streak={prog.streak}
        points={prog.points}
        mono
        lives={<LivesBar lives={prog.lives} />}
        onReset={prog.requestReset}
        gameId="shapeshift"
      />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Spot the Shift"
            steps={[
              "Memorize the four shapes — sometimes identical, sometimes a mixed lineup. You get two seconds.",
              "We shuffle the shutter, and one comes back changed — swapped outright, or barely tilted or resized.",
              "Tap the one that changed. Catches raise the level; the mix skews subtler as you climb.",
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
          <div className="flex flex-col items-center gap-5">
            <VerdictHead
              id="shapeshift-reveal-verdict"
              ok={isUserCorrect}
              headline={isUserCorrect ? "Shift detected." : "It slipped past."}
              mono
            />
            <OutcomeNote outcome={lastOutcome} />

            <Wobble active={!isUserCorrect} className="w-full max-w-sm sm:max-w-3xl">
              {/* Before and after — the changed shape wears the solid ink
                  outline, a wrong pick the thin dashed mid-grey one. Side by
                  side from sm up so the verdict and CTA stay in the fold. */}
              <div className="flex flex-col sm:flex-row sm:justify-center gap-6 sm:gap-10 w-full">
                {(["Before", "After"] as const).map((label) => {
                  const after = label === "After";
                  return (
                    <div key={label} className="sm:flex-1 sm:max-w-sm">
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

            <Btn id="shapeshift-next-btn" variant="secondary" onClick={handleNextRound}>Next four</Btn>
          </div>
        )}
      </div>
      {prog.overlays}
    </div>
  );
};
