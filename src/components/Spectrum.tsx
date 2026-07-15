/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, Reorder } from "motion/react";
import { GameHead, Ready, Btn } from "./ui/Kit";
import { chipColor, dealChips, scoreArrangement, SpectrumResult, CHIP_COUNT } from "../utils/oklab";
import { playTick, playRevealInterval, triggerHaptic } from "../utils/audio";

interface SpectrumProps {
  onBack: () => void;
}

/* The intro glyph: a miniature scrambled-then-smooth chip row */
const SpectrumGlyph: React.FC = () => (
  <span className="flex gap-[4px]" aria-hidden="true">
    {[0, 5, 2, 9, 12].map((chip, i) => (
      <i key={i} className="w-[15px] h-[24px] rounded-[4px]" style={{ background: chipColor(chip) }} />
    ))}
  </span>
);

/* Spectrum — a one-shot hue-arrangement self-check, the only new surface
   that uses color. Hue ordering is the most screen-tolerant vision check:
   it measures RELATIVE ordering, so a miscalibrated display (which shifts
   every chip together) barely moves the result. It reports what happened;
   it never names a condition. */
export const Spectrum: React.FC<SpectrumProps> = ({ onBack }) => {
  const [stage, setStage] = useState<"intro" | "arrange" | "result">("intro");
  const [chips, setChips] = useState<number[]>(() => dealChips());
  const [result, setResult] = useState<SpectrumResult | null>(null);

  const handleDone = () => {
    if (stage !== "arrange") return;
    playRevealInterval();
    setResult(scoreArrangement(chips));
    setStage("result");
  };

  const handleTryAgain = () => {
    playTick();
    triggerHaptic();
    setChips(dealChips());
    setResult(null);
    setStage("arrange");
  };

  const score = result?.score ?? 0;
  const regionText = result?.region ?? "general";
  const interpretation =
    score >= 95
      ? "Your color sorting was very close to the reference."
      : score >= 85
        ? `Your color sorting was mostly accurate, with some mismatches in the ${regionText} range.`
        : `Your color sorting differed noticeably from the reference in the ${regionText} range.`;

  const status =
    stage === "arrange" ? "No timer" :
    stage === "result" ? "Result" :
    "Self-check";

  /* A static row of chips — used on the result screen for both rows */
  const chipRow = (order: number[], idPrefix: string) => (
    <div className="flex gap-1 sm:gap-1.5 w-full">
      {order.map((chip, i) => (
        <i
          key={i}
          id={`${idPrefix}-${i}`}
          className="flex-1 h-9 sm:h-12 rounded-md border-[1.5px] border-line"
          style={{ background: chipColor(chip) }}
        />
      ))}
    </div>
  );

  return (
    <div id="spectrum-container" className="w-full flex flex-col flex-1 max-w-2xl mx-auto">
      <GameHead title="Spectrum" status={status} onBack={onBack} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "intro" && (
          <Ready
            name="Check your color vision"
            steps={[
              `${CHIP_COUNT} color chips appear scrambled in a row.`,
              "Drag them into a smooth color ramp. The wheel has no fixed start — begin anywhere.",
              "No timer. Tap Done when the ramp looks right to you.",
            ]}
            glyph={<span className="scale-150 inline-block"><SpectrumGlyph /></span>}
            ctaLabel="Begin"
            immediate
            onComplete={() => setStage("arrange")}
          />
        )}

        {stage === "arrange" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="flex flex-col items-center gap-9"
          >
            <p className="text-[15px] text-mut max-w-md leading-relaxed text-center">
              <b className="text-ink font-semibold">Drag the chips into a smooth gradient.</b><br />
              Neighbors should blend; nothing should jump.
            </p>

            {/* The working row — chips reorder live under the pointer */}
            <Reorder.Group
              axis="x"
              values={chips}
              onReorder={setChips}
              className="flex gap-1 sm:gap-1.5 w-full list-none p-0"
              id="spectrum-chip-row"
            >
              {chips.map((chip) => (
                <Reorder.Item
                  key={chip}
                  value={chip}
                  className="flex-1 h-20 sm:h-28 rounded-lg border-[1.5px] border-line cursor-grab active:cursor-grabbing touch-none select-none"
                  style={{ background: chipColor(chip) }}
                  whileDrag={{ scale: 1.12, zIndex: 10, boxShadow: "0 6px 0 var(--color-ink)" }}
                  onDragStart={() => triggerHaptic()}
                  aria-label="Color chip"
                />
              ))}
            </Reorder.Group>

            <Btn id="spectrum-done-btn" onClick={handleDone}>Done</Btn>
          </motion.div>
        )}

        {stage === "result" && result && (
          <div className="flex flex-col items-center gap-8">
            <motion.div
              id="spectrum-result-score"
              initial={{ scale: 1.35, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className="flex flex-col items-center text-center"
            >
              <div className="font-mono font-extrabold text-6xl leading-none tabular-nums text-ink">{score}</div>
              <div className="font-mono font-medium text-[11px] tracking-[0.16em] uppercase text-mut mt-2">
                Arrangement / 100
              </div>
            </motion.div>

            {/* Reference vs yours, column-aligned for direct comparison */}
            <div className="flex flex-col gap-5 w-full">
              <div className="flex flex-col gap-2">
                <span className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut">
                  Reference
                </span>
                {chipRow(result.reference, "spectrum-ref-chip")}
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut">
                  Your arrangement
                </span>
                {chipRow(chips, "spectrum-your-chip")}
              </div>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 24, delay: 0.08 }}
              className="text-[15px] text-ink max-w-md leading-relaxed text-center font-semibold"
            >
              {interpretation}
            </motion.p>

            <p className="font-mono font-medium text-[10.5px] tracking-[0.14em] uppercase text-mut max-w-md leading-relaxed text-center">
              This isn't a clinical test. Display calibration, ambient light, and screen quality all affect the
              result. If you scored well below full marks, or you've never had your color vision checked
              professionally, consider seeing an optometrist.
            </p>

            <Btn id="spectrum-try-again-btn" onClick={handleTryAgain}>Try again</Btn>
          </div>
        )}
      </div>
    </div>
  );
};
