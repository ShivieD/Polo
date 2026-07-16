/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { BetweenRoundData } from "../../types";
import { setupBetweenRound, interpolateHsl } from "../../utils/gameLogic";
import { hslToCss } from "../../utils/color";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, NextIn, Btn, PassNote } from "../ui/Kit";
import { BetweenGlyph } from "../ui/Glyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

/* The dark-mode CTA reads yellow rather than the tile's own green — green
   read poorly against the dark wash fill, yellow carries more contrast. */
const CTA_ACCENT = "#ffc400";

export const BetweenGame: React.FC<GameProps> = ({ onBack, onResult, streak }) => {
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<BetweenRoundData>(() => setupBetweenRound());
  const [round, setRound] = useState(1);
  const [countdown, setCountdown] = useState<number>(5);
  const autoAdvanceTimer = useRef<number | null>(null);
  const isDragging = useRef(false);

  /* Next run goes straight to the countdown — no detour to instructions */
  const handleNextRound = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setRoundData(setupBetweenRound());
    setRound((r) => r + 1);
    setStage("countdown");
    setCountdown(5);
  };

  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => setStage("answer"), 2000);
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

  const updatePosition = (clientX: number) => {
    const bar = document.getElementById("between-empty-bar");
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setRoundData((prev) => ({ ...prev, guessPosition: fraction }));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stage !== "answer") return;
    isDragging.current = true;
    updatePosition(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || stage !== "answer") return;
    updatePosition(e.clientX);
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    playTick();
    triggerHaptic();
  };

  const handleDone = () => {
    if (stage !== "answer") return;
    const score = Math.round(100 * (1 - Math.abs(roundData.guessPosition - roundData.truePosition)));
    onResult?.(score >= 80); // 80 is the pass mark; passes feed the streak
    setRoundData((prev) => ({ ...prev, score }));
    setStage("reveal");
  };

  const targetColor = interpolateHsl(roundData.colorStart, roundData.colorEnd, roundData.truePosition);

  /* 21-stop gradient so CSS matches the short-hue-path HSL math exactly */
  const gradientStops = Array.from({ length: 21 }, (_, i) =>
    hslToCss(interpolateHsl(roundData.colorStart, roundData.colorEnd, i / 20))
  );
  const gradientStyle = `linear-gradient(to right, ${gradientStops.join(", ")})`;

  const score = roundData.score ?? 0;
  const verdictHead =
    score >= 95 ? "Surgical." : score >= 80 ? "Sharp eye." : score >= 60 ? "Close." : "Off the mark.";
  const verdictDetail =
    score >= 95
      ? "That is elite hue discrimination."
      : score >= 80
        ? "Within a whisker of true."
        : score >= 60
          ? "Watch the lightness, not just the hue."
          : "The gradient lies to everyone at first. Again.";

  const status =
    stage === "stimulus" ? "Memorize it" :
    stage === "answer" ? "Where does it live?" :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Round ${String(round).padStart(2, "0")}`;

  return (
    <div id="between-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Find the Spot" status={status} onBack={onBack} streak={streak} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Find the Spot"
            steps={[
              "Study and memorize the gradient.",
              "We hide it and show you one color from somewhere inside it.",
              "Move the slider to the spot where you think that color lived.",
            ]}
            glyph={<span className="scale-150 inline-block"><BetweenGlyph /></span>}
            onComplete={() => setStage("stimulus")}
            note={<PassNote tone="color" />}
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
              Memorize the gradient
            </span>
            <div
              id="between-gradient-bar"
              className="w-full max-w-md h-24 rounded-full border-[1.5px] border-line"
              style={{ background: gradientStyle }}
            />
          </motion.div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center w-full gap-7">
            {/* Target specimen */}
            <div className="flex items-center gap-5">
              <div
                id="between-target-swatch"
                className="w-24 h-24 rounded-2xl border-[1.5px] border-line shrink-0"
                style={{ backgroundColor: hslToCss(targetColor) }}
              />
              <p className="text-[15px] text-mut max-w-[26ch] leading-relaxed">
                <b className="text-ink font-semibold">Where does this color live?</b><br />
                Drag the needle to the point on the hidden gradient.
              </p>
            </div>

            {/* The hidden bar — outlined because it's touchable */}
            <div className="w-full max-w-md">
              <div
                id="between-empty-bar"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="w-full h-14 bg-wash border-2 border-ink rounded-full cursor-ew-resize relative select-none touch-none"
              >
                <div
                  className="absolute top-[6px] bottom-[6px] w-[5px] bg-ink rounded-[3px] pointer-events-none"
                  style={{ left: `${roundData.guessPosition * 100}%`, transform: "translateX(-50%)" }}
                >
                  <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-5 h-5 bg-paper border-[3px] border-ink rounded-full" />
                </div>
              </div>
              <div className="flex justify-between font-mono font-medium text-[10px] tracking-[0.14em] text-mut uppercase mt-3 px-1 tabular-nums">
                <span>0</span><span>50</span><span>100</span>
              </div>
            </div>

            <Btn id="between-done-btn" accent={CTA_ACCENT} onClick={handleDone}>Lock it in</Btn>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center w-full gap-6">
            <VerdictHead
              id="between-reveal-verdict"
              ok={score >= 80}
              headline={verdictHead}
              score={String(score)}
              scoreCaption="Accuracy / 100"
            />

            {/* Gradient with staggered pins: Correct above, Your below — the
                tags can never collide, even on a perfect guess */}
            <div className="w-full max-w-md pt-9 pb-8">
              <div className="relative w-full h-14 rounded-full border-[1.5px] border-line" style={{ background: gradientStyle }}>
                <motion.div
                  id="between-marker-true"
                  initial={{ opacity: 0, y: -14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                  className="absolute -top-[14px] bottom-[12px] w-[9px] bg-paper border-2 border-ink rounded-[5px]"
                  style={{ left: `${roundData.truePosition * 100}%`, transform: "translateX(-50%)" }}
                >
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 font-mono font-extrabold text-[10px] tracking-[0.1em] uppercase text-paper bg-play-green rounded-full px-2 py-0.5 whitespace-nowrap">
                    Correct
                  </span>
                </motion.div>
                <motion.div
                  id="between-marker-guess"
                  initial={{ opacity: 0, y: -14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22, delay: 0.12 }}
                  className="absolute top-[12px] -bottom-[14px] w-[5px] bg-ink rounded-[3px]"
                  style={{ left: `${roundData.guessPosition * 100}%`, transform: "translateX(-50%)" }}
                >
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 font-mono font-extrabold text-[10px] tracking-[0.1em] uppercase text-paper bg-ink rounded-full px-2 py-0.5 whitespace-nowrap">
                    Your
                  </span>
                </motion.div>
              </div>
            </div>

            <VerdictBody id="between-reveal-score" detail={verdictDetail} />

            <div className="flex flex-col items-center gap-4">
              <Btn id="between-next-btn" variant="secondary" onClick={handleNextRound}>Next color</Btn>
              <NextIn seconds={countdown} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
