/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { TiltRoundData } from "../../types";
import { setupTiltRound, getTiltParams, scoreTilt, tiltDiff } from "../../utils/shapeLogic";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, NextIn, Btn, PassNote } from "../ui/Kit";
import { TiltGlyph } from "../ui/ShapeGlyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

/* A line through the center of a 100×100 box at the given angle */
const lineEnds = (angle: number, reach = 44) => {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) * reach;
  const dy = -Math.sin(rad) * reach;
  return { x1: 50 - dx, y1: 50 - dy, x2: 50 + dx, y2: 50 + dy };
};

/* Match the Tilt — the Shapes-mode parallel of Color Mixer. Memorize a
   line's rotation, then drag a line back to it. The level schedule shortens
   exposure and tightens the scoring tolerance. Purely greyscale. */
export const TiltGame: React.FC<GameProps> = ({ onBack, onResult, streak }) => {
  const [level, setLevel] = useState(1);
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<TiltRoundData>(() => setupTiltRound());
  const [round, setRound] = useState(1);
  const [countdown, setCountdown] = useState<number>(5);
  const autoAdvanceTimer = useRef<number | null>(null);
  /* Angle of the pointer at the last move event — null when not dragging */
  const lastPointerAngle = useRef<number | null>(null);

  const params = getTiltParams(level);

  /* Pass-gated: 80+ climbs one rung (capped at L6); anything less replays
     the same rung. Next run goes straight to the countdown. */
  const handleNextRound = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if ((roundData.score ?? 0) >= 80) setLevel((l) => Math.min(6, l + 1));
    setRoundData(setupTiltRound());
    setRound((r) => r + 1);
    setStage("countdown");
    setCountdown(5);
  };

  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => setStage("answer"), params.exposure);
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

  /* RELATIVE drag: the line follows how far the pointer has swept around the
     center since the last move — never where it merely sits. A bare click
     applies no delta, so click-to-set (and click-to-cheat) is impossible. */
  const pointerAngle = (clientX: number, clientY: number): number | null => {
    const dial = document.getElementById("tilt-dial");
    if (!dial) return null;
    const rect = dial.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(-(clientY - cy), clientX - cx) * 180) / Math.PI;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stage !== "answer") return;
    lastPointerAngle.current = pointerAngle(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lastPointerAngle.current === null || stage !== "answer") return;
    const pa = pointerAngle(e.clientX, e.clientY);
    if (pa === null) return;
    /* Shortest signed sweep between the two pointer bearings */
    const delta = ((pa - lastPointerAngle.current + 540) % 360) - 180;
    lastPointerAngle.current = pa;
    setRoundData((prev) => ({ ...prev, guessAngle: (((prev.guessAngle + delta) % 180) + 180) % 180 }));
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lastPointerAngle.current === null) return;
    lastPointerAngle.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    playTick();
    triggerHaptic();
  };

  const handleDone = () => {
    if (stage !== "answer") return;
    const score = scoreTilt(roundData.guessAngle, roundData.trueAngle, level);
    onResult?.(score >= 80); // 80 is the pass mark; passes feed the streak
    setRoundData((prev) => ({ ...prev, score }));
    setStage("reveal");
  };

  const score = roundData.score ?? 0;
  const diff = tiltDiff(roundData.guessAngle, roundData.trueAngle);
  const verdictHead =
    score >= 95 ? "Dead level." : score >= 80 ? "Sharp eye." : score >= 60 ? "Close." : "Off the mark.";
  const verdictDetail =
    score >= 95
      ? "That is elite angle memory."
      : score >= 80
        ? `Within ${Math.max(1, Math.round(diff))}° of true — that's a pass.`
        : score >= 60
          ? "Anchor the line against an imaginary clock face next time."
          : "Angles drift fast in memory. Again.";

  const status =
    stage === "stimulus" ? "Memorize it" :
    stage === "answer" ? "Set it back" :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Round ${String(round).padStart(2, "0")}`;

  const truthEnds = lineEnds(roundData.trueAngle);
  const guessEnds = lineEnds(roundData.guessAngle);

  return (
    <div id="tilt-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Match the Tilt" status={status} onBack={onBack} streak={streak} mono level={level} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Match the Tilt"
            steps={[
              "Study and memorize the line's exact tilt — passing shortens the next glimpse.",
              "We take it away. Grab the handle and drag the line back to that angle.",
              "Lock it in to see how many degrees you drifted.",
            ]}
            glyph={<span className="scale-150 inline-block"><TiltGlyph /></span>}
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
              Memorize this tilt
            </span>
            <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-3xl border-[1.5px] border-line bg-paper">
              <svg viewBox="0 0 100 100" className="w-full h-full block" aria-hidden="true">
                <line {...truthEnds} stroke="var(--color-ink)" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </div>
          </motion.div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center w-full gap-7">
            <p className="text-[15px] text-mut max-w-[30ch] leading-relaxed text-center">
              <b className="text-ink font-semibold">Set the line back.</b><br />
              Grab the handle and sweep it around — clicking alone won't move it.
            </p>

            {/* The dial — outlined because it's touchable. The knob on the
                line's end is the drag affordance; the first-entry wiggle
                makes it unmissable. */}
            <div
              id="tilt-dial"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="w-64 h-64 sm:w-72 sm:h-72 rounded-full border-2 border-ink bg-wash cursor-grab active:cursor-grabbing select-none touch-none"
            >
              <svg viewBox="0 0 100 100" className="polo-wiggle w-full h-full block pointer-events-none" aria-hidden="true">
                <line {...guessEnds} stroke="var(--color-ink)" strokeWidth="6" strokeLinecap="round" />
                <circle cx="50" cy="50" r="3.2" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="2" />
                <circle
                  id="tilt-drag-knob"
                  cx={guessEnds.x2}
                  cy={guessEnds.y2}
                  r="5.5"
                  fill="var(--color-paper)"
                  stroke="var(--color-ink)"
                  strokeWidth="2.5"
                />
              </svg>
            </div>

            <Btn id="tilt-done-btn" variant="secondary" onClick={handleDone}>Lock it in</Btn>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center w-full gap-6">
            <VerdictHead
              id="tilt-reveal-verdict"
              ok={score >= 80}
              headline={verdictHead}
              score={String(score)}
              scoreCaption="Accuracy / 100"
              mono
            />

            {/* Both lines overlaid — truth solid, yours dashed mid-grey */}
            <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl border-[1.5px] border-line bg-paper">
              <svg viewBox="0 0 100 100" className="w-full h-full block" aria-hidden="true">
                <line {...guessEnds} stroke="var(--color-mut)" strokeWidth="4" strokeDasharray="7 6" strokeLinecap="round" />
                <line {...truthEnds} stroke="var(--color-ink)" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex items-center gap-6 font-mono font-extrabold text-[10px] tracking-[0.14em] uppercase text-mut">
              <span className="flex items-center gap-2">
                <i className="w-6 h-[4px] bg-ink rounded-full" /> Correct
              </span>
              <span className="flex items-center gap-2">
                <i className="w-6 h-0 border-t-[3px] border-dashed border-mut" /> Your
              </span>
            </div>

            <VerdictBody id="tilt-reveal-score" detail={verdictDetail} />

            <div className="flex flex-col items-center gap-4">
              <Btn id="tilt-next-btn" variant="secondary" onClick={handleNextRound}>Next tilt</Btn>
              <NextIn seconds={countdown} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
