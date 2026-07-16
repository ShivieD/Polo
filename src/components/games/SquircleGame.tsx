/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { SquircleRoundData } from "../../types";
import {
  setupSquircleRound,
  getSquircleParams,
  getSquirclePhase,
  scoreSquircle,
  MAX_RADIUS,
  SQUIRCLE_PASSES_PER_PHASE,
} from "../../utils/shapeLogic";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, NextIn, Btn, PassNote } from "../ui/Kit";
import { SquircleGlyph } from "../ui/ShapeGlyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

type Radii = [number, number, number, number];

/* Corner order matches the CSS border-radius shorthand */
const CORNERS = ["tl", "tr", "br", "bl"] as const;

const radiiCss = (r: Radii) => `${r[0]}% ${r[1]}% ${r[2]}% ${r[3]}%`;

/* Round the Corner — memorize a squircle's corner treatment, then rebuild
   it by dragging Figma-style corner handles. Pass-gated (80+): passing
   shortens the next glimpse, and every 20 passes one more corner breaks
   away from the rest (with the timer reset to the full two seconds).
   Purely greyscale. */
export const SquircleGame: React.FC<GameProps> = ({ onBack, onResult, streak }) => {
  const [level, setLevel] = useState(1);
  const [passes, setPasses] = useState(0);
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<SquircleRoundData>(() => setupSquircleRound(0));
  const [round, setRound] = useState(1);
  /* Mobile alternative to ⌘/Ctrl-drag once corners start splitting */
  const [cornerMode, setCornerMode] = useState<"all" | "one">("all");
  const [countdown, setCountdown] = useState<number>(5);
  const autoAdvanceTimer = useRef<number | null>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ corner: number; single: boolean } | null>(null);
  /* Which handle is being dragged, and whether that drag is shaping just
     that one corner (⌘/Ctrl-drag, or the touch toggle) or all four at
     once — drives the recede-while-dragging look */
  const [activeCorner, setActiveCorner] = useState<number | null>(null);
  const [dragIsSingle, setDragIsSingle] = useState(false);

  const params = getSquircleParams(level);
  const phase = getSquirclePhase(passes);
  /* Once corners split, the glimpse timer resets to the full two seconds —
     the difficulty is carried by the corners, not the clock */
  const exposure = roundData.phase > 0 ? 2000 : params.exposure;

  /* Pass-gated: 80+ climbs one rung (capped at L6) and counts toward the
     corner phases; a miss replays the rung. */
  const handleNextRound = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if ((roundData.score ?? 0) >= 80) setLevel((l) => Math.min(6, l + 1));
    setRoundData(setupSquircleRound(passes));
    setRound((r) => r + 1);
    setStage("countdown");
    setCountdown(5);
  };

  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => setStage("answer"), exposure);
      return () => clearTimeout(timer);
    }
  }, [stage]);

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

  /* ---- corner-handle drag ---- */

  const applyDrag = (clientX: number, clientY: number) => {
    const active = drag.current;
    const rect = squareRef.current?.getBoundingClientRect();
    if (!active || !rect) return;

    /* Inward distance from the active corner along both edges */
    const lx = active.corner === 1 || active.corner === 2 ? rect.right - clientX : clientX - rect.left;
    const ly = active.corner === 2 || active.corner === 3 ? rect.bottom - clientY : clientY - rect.top;
    const inset = ((Math.max(0, lx) + Math.max(0, ly)) / 2 / rect.width) * 100;
    /* Handles sit at ~0.71×radius inset (the curve's midpoint), so invert
       that to keep the drag feeling 1:1 */
    const r = Math.max(0, Math.min(MAX_RADIUS, inset / 0.71));

    setRoundData((prev) => {
      const next = [...prev.guessRadii] as Radii;
      if (active.single) next[active.corner] = r;
      else next.fill(r);
      return { ...prev, guessRadii: next };
    });
  };

  const handleHandleDown = (corner: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (stage !== "answer") return;
    const single = e.metaKey || e.ctrlKey || cornerMode === "one";
    drag.current = { corner, single };
    setActiveCorner(corner);
    setDragIsSingle(single);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const handleHandleMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || stage !== "answer") return;
    applyDrag(e.clientX, e.clientY);
  };
  const handleHandleUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setActiveCorner(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
    playTick();
    triggerHaptic();
  };

  const handleDone = () => {
    if (stage !== "answer") return;
    const score = scoreSquircle(roundData.guessRadii, roundData.trueRadii, level);
    onResult?.(score >= 80); // 80 is the pass mark; passes feed the streak
    if (score >= 80) setPasses((p) => p + 1);
    setRoundData((prev) => ({ ...prev, score }));
    setStage("reveal");
  };

  const score = roundData.score ?? 0;
  const verdictHead =
    score >= 95 ? "Curve whisperer." : score >= 80 ? "Sharp eye." : score >= 60 ? "Close." : "Off the curve.";
  const verdictDetail =
    score >= 95
      ? "That is elite curvature memory."
      : score >= 80
        ? "Within a hair of the true corners — that's a pass."
        : score >= 60
          ? "Watch where the straight edge ends, not where the curve begins."
          : "Corners lie to everyone at first. The level stays put until you pass.";

  const status =
    stage === "stimulus" ? "Memorize it" :
    stage === "answer" ? "Rebuild the corners" :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Round ${String(round).padStart(2, "0")}`;

  /* One squircle: a filled square whose border-radius IS the quantity
     being judged */
  const squircle = (radii: Radii, sizeClass: string, id?: string, ghost = false) => (
    <div id={id} className={`${sizeClass} ${ghost ? "bg-mut" : "bg-ink"}`} style={{ borderRadius: radiiCss(radii) }} />
  );

  /* Handle position: inset from its corner proportionally to that corner's
     radius, clamped so it never leaves reach. The floor sits inward enough
     that tight radii keep the square's own corner visible behind the dot.
     While a handle is being dragged it recedes — half opacity, shrunk 30%
     about its own center — so the curve stays readable under the finger.
     An all-corners drag moves every corner at once, so every dot recedes
     together; only a ⌘/Ctrl (or toggled) single-corner drag isolates the
     one actually being held. */
  const handleStyle = (corner: number): React.CSSProperties => {
    const inset = `${Math.max(8, Math.min(33, roundData.guessRadii[corner] * 0.71))}%`;
    const onRight = corner === 1 || corner === 2;
    const onBottom = corner === 2 || corner === 3;
    const dragging = activeCorner !== null && (dragIsSingle ? activeCorner === corner : true);
    return {
      left: onRight ? undefined : inset,
      right: onRight ? inset : undefined,
      top: onBottom ? undefined : inset,
      bottom: onBottom ? inset : undefined,
      transform: `translate(${onRight ? "50%" : "-50%"}, ${onBottom ? "50%" : "-50%"})${dragging ? " scale(0.7)" : ""}`,
      opacity: dragging ? 0.5 : 1,
      transition: "opacity 0.12s ease",
    };
  };

  const readySteps = [
    "Study the rounded square — how soft is each corner? Passing shortens the glimpse.",
    "Rebuild it on a fresh square by dragging the corner handles.",
    `Pass ${SQUIRCLE_PASSES_PER_PHASE} rounds and corners start going their own way — ⌘/Ctrl-drag (or the toggle on touch screens) shapes one corner alone.`,
  ];

  return (
    <div id="squircle-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Round the Corner" status={status} onBack={onBack} streak={streak} mono level={level} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Round the Corner"
            steps={readySteps}
            glyph={<span className="scale-150 inline-block"><SquircleGlyph /></span>}
            onComplete={() => setStage("stimulus")}
            mono
            note={<PassNote />}
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
              {roundData.phase > 0 ? "Memorize every corner" : "Memorize this curve"}
            </span>
            {squircle(roundData.trueRadii, "w-48 h-48 sm:w-56 sm:h-56", "squircle-stimulus-box")}
          </motion.div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center w-full gap-7">
            {/* The workbench: the square plus its four corner handles */}
            <div ref={squareRef} className="relative w-56 h-56 sm:w-64 sm:h-64 touch-none select-none">
              <div
                id="squircle-interactive-box"
                className="w-full h-full bg-ink"
                style={{ borderRadius: radiiCss(roundData.guessRadii) }}
              />
              {CORNERS.map((name, i) => (
                <button
                  key={name}
                  id={`squircle-handle-${name}`}
                  onPointerDown={handleHandleDown(i)}
                  onPointerMove={handleHandleMove}
                  onPointerUp={handleHandleUp}
                  aria-label={`Corner handle ${name}`}
                  className="absolute w-5 h-5 rounded-full bg-paper border-[3px] border-ink cursor-grab active:cursor-grabbing"
                  style={handleStyle(i)}
                />
              ))}
            </div>

            <div className="flex flex-col items-center gap-3">
              <span className="font-mono font-extrabold text-[11px] tracking-[0.12em] uppercase text-mut tabular-nums">
                Corners · {roundData.guessRadii.map((r) => Math.round(r)).join(" · ")}
              </span>
              {phase > 0 && (
                <>
                  <span className="hidden sm:block font-sans font-bold text-[15px] text-ink">
                    ⌘ / Ctrl-drag a handle to shape one corner
                  </span>
                  {/* Touch screens get a mode toggle instead of a modifier key */}
                  <div className="sm:hidden inline-flex border-2 border-ink rounded-full p-0.5" role="tablist" aria-label="Corner mode">
                    {(["all", "one"] as const).map((m) => (
                      <button
                        key={m}
                        id={`squircle-corner-mode-${m}`}
                        role="tab"
                        aria-selected={cornerMode === m}
                        onClick={() => {
                          playTick();
                          setCornerMode(m);
                        }}
                        className={`px-4 py-1.5 rounded-full font-mono font-extrabold text-[10px] tracking-[0.12em] uppercase cursor-pointer ${
                          cornerMode === m ? "bg-ink text-paper" : "text-ink"
                        }`}
                      >
                        {m === "all" ? "All corners" : "One corner"}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <Btn id="squircle-done-btn" variant="secondary" onClick={handleDone}>Lock it in</Btn>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-7">
            <VerdictHead
              id="squircle-reveal-verdict"
              ok={score >= 80}
              headline={verdictHead}
              score={String(score)}
              scoreCaption="Match / 100"
              mono
            />

            {/* Truth and guess side by side — truth in ink, yours mid-grey */}
            <div className="flex items-end gap-6">
              <div className="flex flex-col items-center gap-2.5">
                {squircle(roundData.trueRadii, "w-32 h-32 sm:w-36 sm:h-36", "squircle-reveal-target")}
                <span className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-mut">Correct</span>
              </div>
              <div className="flex flex-col items-center gap-2.5">
                {squircle(roundData.guessRadii, "w-32 h-32 sm:w-36 sm:h-36", "squircle-reveal-guess", true)}
                <span className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-mut">Your</span>
              </div>
            </div>

            <VerdictBody id="squircle-reveal-score" detail={verdictDetail} />

            <div className="flex flex-col items-center gap-4">
              <Btn id="squircle-next-btn" variant="secondary" onClick={handleNextRound}>Next curve</Btn>
              <NextIn seconds={countdown} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
