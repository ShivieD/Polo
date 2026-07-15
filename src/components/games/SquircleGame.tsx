/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { SquircleRoundData } from "../../types";
import { setupSquircleRound, getSquircleParams, scoreSquircle, MAX_RADIUS } from "../../utils/shapeLogic";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, NextIn, Btn } from "../ui/Kit";
import { SquircleGlyph } from "../ui/ShapeGlyphs";
import { playRevealInterval } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

/* Round the Corner — memorize a squircle's corner radius, then grow a
   square's corners until they match. The level schedule shortens exposure
   and tightens the radius tolerance. Purely greyscale. */
export const SquircleGame: React.FC<GameProps> = ({ onBack, onResult, streak }) => {
  const [level, setLevel] = useState(1);
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<SquircleRoundData>(() => setupSquircleRound());
  const [round, setRound] = useState(1);
  const [countdown, setCountdown] = useState<number>(5);
  const autoAdvanceTimer = useRef<number | null>(null);

  const params = getSquircleParams(level);

  /* Fixed schedule: every round climbs one rung, capped at L6, and a wrong
     answer never rolls it back. Next run goes straight to the countdown. */
  const handleNextRound = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setLevel((l) => Math.min(6, l + 1));
    setRoundData(setupSquircleRound());
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

  const handleDone = () => {
    if (stage !== "answer") return;
    const score = scoreSquircle(roundData.guessRadius, roundData.trueRadius, level);
    onResult?.(score >= 85); // record the result once, at answer time
    setRoundData((prev) => ({ ...prev, score }));
    setStage("reveal");
  };

  const score = roundData.score ?? 0;
  const verdictHead =
    score >= 95 ? "Curve whisperer." : score >= 85 ? "Sharp eye." : score >= 65 ? "Close." : "Off the curve.";
  const verdictDetail =
    score >= 95
      ? "That is elite curvature memory."
      : score >= 85
        ? "Within a hair of the true corner."
        : score >= 65
          ? "Watch where the straight edge ends, not where the curve begins."
          : "Corners lie to everyone at first. Again.";

  const status =
    stage === "stimulus" ? "Memorize it" :
    stage === "answer" ? "Rebuild the curve" :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Round ${String(round).padStart(2, "0")}`;

  /* One squircle: a filled ink square whose border-radius is the radius in
     % of side — the exact quantity being judged */
  const squircle = (radius: number, sizeClass: string, id?: string, ghost = false) => (
    <div
      id={id}
      className={`${sizeClass} ${ghost ? "bg-mut" : "bg-ink"}`}
      style={{ borderRadius: `${radius}%` }}
    />
  );

  return (
    <div id="squircle-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Round the Corner" status={status} onBack={onBack} streak={streak} mono level={level} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Round the Corner"
            steps={[
              "Study the rounded square — how soft are its corners? The glimpse gets shorter each round.",
              "We take it away. Grow a fresh square's corners with the slider until they match.",
              "Lock it in to see how close your curve really is.",
            ]}
            glyph={<span className="scale-150 inline-block"><SquircleGlyph /></span>}
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
              Memorize this curve
            </span>
            {squircle(roundData.trueRadius, "w-48 h-48 sm:w-56 sm:h-56", "squircle-stimulus-box")}
          </motion.div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center w-full gap-7">
            {squircle(roundData.guessRadius, "w-40 h-40 sm:w-48 sm:h-48", "squircle-interactive-box")}

            <div className="w-full max-w-sm flex flex-col">
              <div className="flex justify-between font-mono font-extrabold text-[11px] tracking-[0.12em] uppercase text-ink mb-2.5 tabular-nums">
                <span>Corner</span>
                <span>{Math.round(roundData.guessRadius)}</span>
              </div>
              <input
                id="squircle-slider"
                type="range"
                min={0}
                max={MAX_RADIUS}
                step={0.5}
                value={roundData.guessRadius}
                onChange={(e) => {
                  if (stage !== "answer") return;
                  setRoundData((prev) => ({ ...prev, guessRadius: parseFloat(e.target.value) }));
                }}
                className="polo-range w-full"
                style={{ background: "linear-gradient(to right, var(--color-line), var(--color-mut))" }}
                aria-label="Corner radius"
              />
            </div>

            <Btn id="squircle-done-btn" variant="secondary" onClick={handleDone}>Lock it in</Btn>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-7">
            <VerdictHead
              id="squircle-reveal-verdict"
              ok={score >= 85}
              headline={verdictHead}
              score={String(score)}
              scoreCaption="Match / 100"
              mono
            />

            {/* Truth and guess side by side — truth in ink, yours mid-grey */}
            <div className="flex items-end gap-6">
              <div className="flex flex-col items-center gap-2.5">
                {squircle(roundData.trueRadius, "w-32 h-32 sm:w-36 sm:h-36", "squircle-reveal-target")}
                <span className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-mut">Correct</span>
              </div>
              <div className="flex flex-col items-center gap-2.5">
                {squircle(roundData.guessRadius, "w-32 h-32 sm:w-36 sm:h-36", "squircle-reveal-guess", true)}
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
