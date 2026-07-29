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

const D15_URL =
  "https://www.color-blind-test.com/d15-color-blind-test-more#:~:text=Farnsworth.,given%20colors%20and%20make%20mistakes.";
const FM100_URL =
  "https://www.colorlitelens.com/farnsworth-munsell-100-color-blind-test-more#farnsworth-munsell-100-hue-test";

/* The real test each level nods to, linked from its name */
const TestLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="font-semibold text-ink underline decoration-dotted decoration-1 underline-offset-4 hover:decoration-solid hover:decoration-play-blue hover:decoration-2"
  >
    {children}
  </a>
);

/* Rough hue names on the OkLCh wheel (NOT HSL degrees — OkLCh 0° sits in
   pink, ~145° in green, ~265° in blue), for labelling the Level 2 rows by
   the arc of the wheel they cover. */
const hueName = (hDeg: number): string => {
  const h = ((hDeg % 360) + 360) % 360;
  if (h < 20) return "Pink";
  if (h < 45) return "Red";
  if (h < 75) return "Orange";
  if (h < 105) return "Yellow";
  if (h < 135) return "Lime";
  if (h < 165) return "Green";
  if (h < 200) return "Teal";
  if (h < 235) return "Cyan";
  if (h < 275) return "Blue";
  if (h < 315) return "Violet";
  if (h < 345) return "Magenta";
  return "Pink";
};

const rowSpanName = (t: Tray): string => {
  const from = hueName(t.hues[0]);
  const to = hueName(t.hues[t.hues.length - 1]);
  return from === to ? from : `${from} → ${to}`;
};

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
  /* The one chip currently in hand. Drag visuals key off this state rather
     than whileHover/whileDrag — the gesture flags could stick "focused"
     after a drop (hover never resolves on touch), leaving the chip scaled. */
  const [draggingChip, setDraggingChip] = useState<string | null>(null);

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
          {middle.map((chip) => {
            const itemKey = `${idPrefix}-${chip}`;
            const held = draggingChip === itemKey;
            return (
              <Reorder.Item
                key={chip}
                value={chip}
                as="div"
                className={`${chipClass(false, h)} spectrum-chip cursor-grab active:cursor-grabbing touch-none select-none`}
                style={{ background: hueColor(t.hues[chip]) }}
                animate={{
                  scale: held ? 1.14 : 1,
                  zIndex: held ? 10 : 0,
                  boxShadow: held ? "0 6px 0 var(--color-ink)" : "0 0 0 rgba(0,0,0,0)",
                }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                onDragStart={() => {
                  setDraggingChip(itemKey);
                  triggerHaptic();
                }}
                onDragEnd={() => {
                  setDraggingChip(null);
                  playTick();
                  triggerHaptic();
                }}
                aria-label="Color chip"
              />
            );
          })}
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

  /* Reference / Yours as a labelled pair — the tag rides beside its own
     row, so the eye never has to carry a legend down from a header. */
  const rowTag = (label: string) => (
    <span className="w-11 sm:w-14 shrink-0 text-right font-mono font-extrabold text-[9px] sm:text-[10px] tracking-[0.14em] uppercase text-mut">
      {label}
    </span>
  );

  const comparePair = (t: Tray, h: string, idPrefix: string, title?: string) => (
    <div className="flex flex-col gap-1.5 w-full">
      {title && (
        <span className="font-mono font-extrabold text-[10px] tracking-[0.16em] uppercase text-ink pl-[56px] sm:pl-[68px] mb-0.5">
          {title}
        </span>
      )}
      <div className="flex items-center gap-3">
        {rowTag("Ref")}
        <div className="flex-1 min-w-0">{staticTray(t, referenceOrder, h, `${idPrefix}-ref`)}</div>
      </div>
      <div className="flex items-center gap-3">
        {rowTag("Yours")}
        <div className="flex-1 min-w-0">{staticTray(t, t.order, h, `${idPrefix}-your`)}</div>
      </div>
    </div>
  );

  /* Result copy stack — a deliberate type ramp: the score number (set
     elsewhere) leads, the read-out headline follows in bold text, the
     what-is-this description sits quieter below it, and the not-a-clinical-
     test note gets its own unmissable callout box rather than a whispered
     mono footnote. */
  const resultChrome = (description: React.ReactNode, actions: React.ReactNode) => (
    <>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 24, delay: 0.08 }}
        className="text-[17px] sm:text-[18px] text-ink max-w-lg leading-snug text-center font-bold"
      >
        {interpretation}
      </motion.p>

      {/* What this test actually is, in one breath — test name links out */}
      <p className="text-[13.5px] text-mut max-w-md leading-relaxed text-center">{description}</p>

      <div className="polo-note rounded-2xl px-5 py-4 flex items-start gap-4 max-w-xl w-full">
        <span
          aria-hidden="true"
          className="shrink-0 w-6 h-6 mt-0.5 rounded-md border-2 border-current flex items-center justify-center font-mono font-extrabold text-[13px]"
        >
          !
        </span>
        <p className="text-[13px] leading-relaxed text-left">
          <b>This isn't a clinical test.</b> Display calibration, ambient light, and screen quality all
          affect the result. If you scored well below full marks, or you've never had your color vision
          checked professionally, consider seeing an optometrist.
        </p>
      </div>

      {actions}
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
      <GameHead title="Spectrum" onBack={onBack} />

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
            {comparePair(tray, "h-9 sm:h-12", "spectrum-l1")}

            {resultChrome(
              <>
                Spectrum is a hue-arrangement self-check in the spirit of the{" "}
                <TestLink href={D15_URL}>Farnsworth D-15</TestLink>: you order colors between two fixed
                anchors, and where the misplaced chips cluster hints at which color axis — if any — gives
                your eyes trouble.
              </>,
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Btn id="spectrum-try-again-btn" variant="secondary" onClick={() => restart("arrange")}>
                  Try again
                </Btn>
                <span className="relative inline-flex group">
                  {/* Real tooltip, not reserved layout space — floats above
                      the CTA and only appears on hover/focus. Dark chip in
                      light mode, play-yellow chip in dark mode (both always
                      carry white text, since both chips are dark-toned). */}
                  <span
                    role="tooltip"
                    className="spectrum-tooltip pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md px-3 py-1.5 font-sans text-[12px] font-semibold text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                  >
                    The Farnsworth-Munsell 100-hue drill
                  </span>
                  <Btn id="spectrum-level2-btn" onClick={() => restart("arrange2")}>
                    Go deeper — Level 2
                  </Btn>
                </span>
              </div>
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

            <div className="flex flex-col gap-5 w-full">
              {trays.map((t, r) => (
                <React.Fragment key={r}>
                  {comparePair(t, "h-5 sm:h-6", `spectrum-l2-${r}`, rowSpanName(t))}
                </React.Fragment>
              ))}
            </div>

            {resultChrome(
              <>
                Level 2 splits the wheel into four rows with hue steps three times finer — the same idea
                as the <TestLink href={FM100_URL}>Farnsworth-Munsell 100-hue test</TestLink>, surfacing
                subtler confusions than the single-row check.
              </>,
              <div className="flex flex-col items-center gap-4">
                <Btn id="spectrum-l2-try-again-btn" onClick={() => restart("arrange2")}>Try again</Btn>
                <button
                  id="spectrum-back-l1-btn"
                  onClick={() => restart("arrange")}
                  className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-mut underline underline-offset-4 decoration-2 cursor-pointer"
                >
                  Back to the simple check
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
