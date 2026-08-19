/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ShiftRoundData } from "../../types";
import { setupShiftRound } from "../../utils/gameLogic";
import { hslToCss } from "../../utils/color";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, Btn, Loader, Wobble } from "../ui/Kit";
import { useProgression, LivesBar, OutcomeNote } from "../ui/Progress";
import { RunOutcome } from "../../utils/progression";
import { ShiftGlyph } from "../ui/Glyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

type ShiftStage = "getReady" | "countdown" | "stimulus" | "interstitial" | "answer" | "reveal";

/* The dark-mode CTA reads yellow rather than the tile's own blue — blue
   read poorly against the dark wash fill, yellow carries more contrast. */
const CTA_ACCENT = "#ffc400";

export const ShiftGame: React.FC<GameProps> = ({ onBack, onResult, accentColor }) => {
  const prog = useProgression("shift");
  const [stage, setStage] = useState<ShiftStage>("getReady");
  const [roundData, setRoundData] = useState<ShiftRoundData>(() => setupShiftRound(prog.ramp));
  const [lastOutcome, setLastOutcome] = useState<RunOutcome | null>(null);

  /* Next run waits for the CTA — no auto-advance */
  const handleNextRound = () => {
    setRoundData(setupShiftRound(prog.ramp));
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

  const isUserCorrect = roundData.userSelection === roundData.shiftedIndex;

  useEffect(() => {
    if (stage === "reveal") playRevealInterval();
  }, [stage]);

  const handleSelectSquare = (idx: number) => {
    if (stage !== "answer") return;
    playTick();
    triggerHaptic();
    onResult?.(idx === roundData.shiftedIndex); // record the result once, at answer time
    setLastOutcome(prog.report(idx === roundData.shiftedIndex, idx === roundData.shiftedIndex ? 100 : 0));
    setRoundData((prev) => ({ ...prev, userSelection: idx }));
    setStage("reveal");
  };

  /* Columns are chosen so the grid never runs past two rows — the tile count
     climbs to nine, and a third row would push the CTA below the fold. */
  const tileCount = roundData.originalColors.length;
  const cols = tileCount <= 4 ? 4 : tileCount <= 6 ? 3 : tileCount <= 8 ? 4 : 5;
  /* Laid out as centred flex-wrap rather than a grid: with 5 tiles in 3
     columns the grid left-aligned the 2 leftovers, which made the Before and
     After boards look like they held different numbers of tiles. */
  const tileW = { width: `calc((100% - ${(cols - 1) * 12}px) / ${cols})` };
  const rowCls = "flex flex-wrap justify-center gap-3";

  return (
    <div id="shift-game-container" className="w-full flex flex-col flex-1 max-w-3xl mx-auto">
      <GameHead
        title="Spot the Difference"
        onBack={onBack}
        streak={prog.streak}
        points={prog.points}
        gameId="shift"
        accent={accentColor}
        lives={<LivesBar lives={prog.lives} />}
        onReset={prog.requestReset}
      />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Spot the Difference"
            steps={[
              "Memorize the color blocks — every level adds one more. You get two seconds.",
              "We shuffle the shutter, and one block comes back slightly off.",
              "Tap the block that changed.",
            ]}
            glyph={<span className="scale-150 inline-block"><ShiftGlyph /></span>}
            onComplete={() => setStage("stimulus")}
            accentColor={CTA_ACCENT}
          />
        )}

        {stage === "countdown" && <Countdown onComplete={() => setStage("stimulus")} />}

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
            <div className={`${rowCls} w-full max-w-lg`}>
              {roundData.originalColors.map((color, idx) => (
                <motion.div
                  key={idx}
                  id={`shift-stimulus-square-${idx}`}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.07, type: "spring", stiffness: 400, damping: 20 }}
                  className="aspect-square rounded-2xl"
                  style={{ ...tileW, backgroundColor: hslToCss(color) }}
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
            <div className={`${rowCls} w-full max-w-lg`}>
              {roundData.originalColors.map((_, idx) => (
                <button
                  key={idx}
                  id={`shift-answer-square-${idx}`}
                  onClick={() => handleSelectSquare(idx)}
                  className="cell-pop aspect-square rounded-2xl cursor-pointer"
                  style={{ ...tileW, backgroundColor: hslToCss(roundData.shiftedColors[idx]) }}
                  aria-label={`Block ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-7">
            <VerdictHead
              id="shift-reveal-verdict"
              ok={isUserCorrect}
              headline={isUserCorrect ? "Drift detected." : "It slipped past."}
            />
            <OutcomeNote outcome={lastOutcome} />

            <Wobble active={!isUserCorrect} className="w-full max-w-xl">
              {/* Both grids at full, true color — no fading. Before and after sit
                  side by side so the pair costs one row of height, not two.
                  Tags live BELOW the tiles so they never blend into a swatch. */}
              <div className="grid grid-cols-2 gap-0 w-full">
                <div className="pr-6">
                  <div className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut mb-2.5">
                    Before
                  </div>
                  <div className={rowCls}>
                    {roundData.originalColors.map((color, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-1.5" style={tileW}>
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

                <div className="pl-6 border-l-[1.5px] border-line">
                  <div className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut mb-2.5">
                    After
                  </div>
                  <div className={rowCls}>
                    {/* Driven off originalColors so Before and After are
                        structurally guaranteed to render the same tile count. */}
                    {roundData.originalColors.map((_, idx) => {
                      const color = roundData.shiftedColors[idx];
                      const isShifted = roundData.shiftedIndex === idx;
                      const isSelected = roundData.userSelection === idx;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5" style={tileW}>
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

            <VerdictBody
              detail={
                isUserCorrect
                  ? "You caught the changed block dead on. Compare before and after to see the drift."
                  : "Compare before and after — the block that changed is tagged Correct."
              }
            />

            <Btn id="shift-next-btn" variant="secondary" onClick={handleNextRound}>Next grid</Btn>
          </div>
        )}
      </div>
      {prog.overlays}
    </div>
  );
};
