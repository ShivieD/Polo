/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, Reorder } from "motion/react";
import { GameHead, Ready, Btn } from "./ui/Kit";
import {
  hueColor,
  rowHues,
  dealRow,
  combineRows,
  SpectrumResult,
  ROW_CHIPS,
  L1_SPAN,
  L2_SPAN,
} from "../utils/oklab";
import { playTick, playRevealInterval, triggerHaptic } from "../utils/audio";

interface SpectrumProps {
  onBack: () => void;
}

interface Tray {
  hues: number[];
  order: number[];
}

const freshL1 = (): Tray => {
  const base = Math.random() * 360;
  return { hues: rowHues(base, L1_SPAN), order: dealRow() };
};

/* Four contiguous quarter-wheel trays with finer steps — the FM-100 spirit */
const freshL2 = (): Tray[] => {
  const base = Math.random() * 360;
  return Array.from({ length: 4 }, (_, r) => ({
    hues: rowHues(base + r * 90, L2_SPAN),
    order: dealRow(),
  }));
};

/* The intro glyph: a miniature scrambled-then-smooth chip row */
const SpectrumGlyph: React.FC = () => (
  <span className="flex gap-[4px]" aria-hidden="true">
    {[0, 130, 60, 210, 300].map((hue, i) => (
      <i key={i} className="w-[15px] h-[24px] rounded-[4px]" style={{ background: hueColor(hue) }} />
    ))}
  </span>
);

const DISCLAIMER =
  "This isn't a clinical test. Display calibration, ambient light, and screen quality all affect the result. " +
  "If you scored well below full marks, or you've never had your color vision checked professionally, consider seeing an optometrist.";

/* Spectrum — a one-shot hue-arrangement self-check, the only new surface
   that uses color. Like the Farnsworth panel tests it measures RELATIVE
   ordering between fixed anchor chips, so a miscalibrated display (which
   shifts every chip together) barely moves the result. It reports what
   happened; it never names a condition. */
export const Spectrum: React.FC<SpectrumProps> = ({ onBack }) => {
  const [stage, setStage] = useState<"intro" | "arrange" | "result" | "arrange2" | "result2">("intro");
  const [tray, setTray] = useState<Tray>(freshL1);
  const [trays, setTrays] = useState<Tray[]>(freshL2);
  const [result, setResult] = useState<SpectrumResult | null>(null);

  const finish = (rows: Tray[], to: "result" | "result2") => {
    playRevealInterval();
    setResult(combineRows(rows));
    setStage(to);
  };

  const restart = (to: "arrange" | "arrange2") => {
    playTick();
    triggerHaptic();
    if (to === "arrange") setTray(freshL1());
    else setTrays(freshL2());
    setResult(null);
    setStage(to);
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
    stage === "arrange2" ? "Level 2 · No timer" :
    stage === "result" ? "Result" :
    stage === "result2" ? "Level 2 · Result" :
    "Self-check";

  /* One chip. Anchors wear the ink border and don't drag. */
  const chipClass = (anchor: boolean, h: string) =>
    `${h} flex-1 rounded-md ${anchor ? "border-2 border-ink" : "border-[1.5px] border-line"}`;

  /* A live, reorderable tray: pinned ends outside the Reorder group,
     the middle chips springy and draggable between them. */
  const liveTray = (t: Tray, onOrder: (order: number[]) => void, h: string, idPrefix: string) => {
    const middle = t.order.slice(1, -1);
    return (
      <div className="flex gap-1 sm:gap-1.5 w-full items-stretch" id={idPrefix}>
        <i className={chipClass(true, h)} style={{ background: hueColor(t.hues[0]) }} aria-label="Fixed anchor chip" />
        <Reorder.Group
          axis="x"
          values={middle}
          onReorder={(mid: number[]) => onOrder([0, ...mid, ROW_CHIPS - 1])}
          className="contents"
          as="div"
        >
          {middle.map((chip) => (
            <Reorder.Item
              key={chip}
              value={chip}
              as="div"
              className={`${chipClass(false, h)} cursor-grab active:cursor-grabbing touch-none select-none`}
              style={{ background: hueColor(t.hues[chip]) }}
              whileHover={{ scale: 1.07, y: -4 }}
              whileDrag={{ scale: 1.14, zIndex: 10, boxShadow: "0 6px 0 var(--color-ink)" }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              onDragStart={() => triggerHaptic()}
              onDragEnd={() => {
                playTick();
                triggerHaptic();
              }}
              aria-label="Color chip"
            />
          ))}
        </Reorder.Group>
        <i
          className={chipClass(true, h)}
          style={{ background: hueColor(t.hues[ROW_CHIPS - 1]) }}
          aria-label="Fixed anchor chip"
        />
      </div>
    );
  };

  /* A static tray for result screens */
  const staticTray = (t: Tray, order: number[], h: string, idPrefix: string) => (
    <div className="flex gap-1 sm:gap-1.5 w-full">
      {order.map((chip, i) => (
        <i
          key={i}
          id={`${idPrefix}-${i}`}
          className={chipClass(i === 0 || i === order.length - 1, h)}
          style={{ background: hueColor(t.hues[chip]) }}
        />
      ))}
    </div>
  );

  const referenceOrder = Array.from({ length: ROW_CHIPS }, (_, i) => i);

  const resultChrome = (description: string, tryAgain: () => void, extra?: React.ReactNode) => (
    <>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 24, delay: 0.08 }}
        className="text-[15px] text-ink max-w-md leading-relaxed text-center font-semibold"
      >
        {interpretation}
      </motion.p>

      {/* What this test actually is, in one breath */}
      <p className="text-[13.5px] text-mut max-w-md leading-relaxed text-center">{description}</p>

      <p className="font-mono font-medium text-[10.5px] tracking-[0.14em] uppercase text-mut max-w-md leading-relaxed text-center">
        {DISCLAIMER}
      </p>

      <div className="flex flex-col items-center gap-4">
        <Btn id="spectrum-try-again-btn" onClick={tryAgain}>Try again</Btn>
        {extra}
      </div>
    </>
  );

  const bigScore = (
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
  );

  return (
    <div id="spectrum-container" className="w-full flex flex-col flex-1 max-w-2xl mx-auto">
      <GameHead title="Spectrum" status={status} onBack={onBack} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "intro" && (
          <Ready
            name="Check your color vision"
            steps={[
              `${ROW_CHIPS} color chips sit in a row. The first and the last are fixed anchors.`,
              "Drag the chips between them into a smooth ramp from one anchor to the other.",
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
              <b className="text-ink font-semibold">Drag the chips into a smooth ramp.</b><br />
              The outlined end chips are fixed — build the bridge between them.
            </p>

            {liveTray(tray, (order) => setTray((t) => ({ ...t, order })), "h-20 sm:h-28", "spectrum-chip-row")}

            <Btn id="spectrum-done-btn" onClick={() => finish([tray], "result")}>Done</Btn>
          </motion.div>
        )}

        {stage === "result" && result && (
          <div className="flex flex-col items-center gap-7">
            {bigScore}

            {/* Reference vs yours, column-aligned for direct comparison */}
            <div className="flex flex-col gap-5 w-full">
              <div className="flex flex-col gap-2">
                <span className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut">
                  Reference
                </span>
                {staticTray(tray, referenceOrder, "h-9 sm:h-12", "spectrum-ref-chip")}
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut">
                  Your arrangement
                </span>
                {staticTray(tray, tray.order, "h-9 sm:h-12", "spectrum-your-chip")}
              </div>
            </div>

            {resultChrome(
              "Spectrum is a hue-arrangement self-check in the spirit of the Farnsworth D-15: you order colors between two fixed anchors, and where the misplaced chips cluster hints at which color axis — if any — gives your eyes trouble.",
              () => restart("arrange"),
              <button
                id="spectrum-level2-btn"
                onClick={() => restart("arrange2")}
                className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-ink underline underline-offset-4 decoration-2 hover:decoration-play-blue cursor-pointer"
              >
                Go deeper — Level 2 →
              </button>
            )}
          </div>
        )}

        {stage === "arrange2" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="flex flex-col items-center gap-7"
          >
            <p className="text-[15px] text-mut max-w-md leading-relaxed text-center">
              <b className="text-ink font-semibold">Four rows, finer steps.</b><br />
              Arrange each row between its fixed ends — together they cover the whole wheel.
            </p>

            <div className="flex flex-col gap-3 w-full">
              {trays.map((t, r) => (
                <React.Fragment key={r}>
                  {liveTray(
                    t,
                    (order) => setTrays((prev) => prev.map((row, i) => (i === r ? { ...row, order } : row))),
                    "h-10 sm:h-14",
                    `spectrum-l2-row-${r}`
                  )}
                </React.Fragment>
              ))}
            </div>

            <Btn id="spectrum-l2-done-btn" onClick={() => finish(trays, "result2")}>Done</Btn>
          </motion.div>
        )}

        {stage === "result2" && result && (
          <div className="flex flex-col items-center gap-7">
            {bigScore}

            <div className="flex flex-col gap-4 w-full">
              {trays.map((t, r) => (
                <div key={r} className="flex flex-col gap-1.5">
                  <span className="font-mono font-extrabold text-[10px] tracking-[0.16em] uppercase text-mut tabular-nums">
                    Row {r + 1} · Reference / Yours
                  </span>
                  {staticTray(t, referenceOrder, "h-5 sm:h-6", `spectrum-l2-ref-${r}`)}
                  {staticTray(t, t.order, "h-5 sm:h-6", `spectrum-l2-your-${r}`)}
                </div>
              ))}
            </div>

            {resultChrome(
              "Level 2 splits the wheel into four rows with hue steps three times finer — the same idea as the Farnsworth-Munsell 100-hue test, surfacing subtler confusions than the single-row check.",
              () => restart("arrange2"),
              <button
                id="spectrum-back-l1-btn"
                onClick={() => restart("arrange")}
                className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-mut underline underline-offset-4 decoration-2 cursor-pointer"
              >
                Back to the simple check
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
