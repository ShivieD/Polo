/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { MixRoundData } from "../../types";
import { setupMixRound } from "../../utils/gameLogic";
import { hslToCss, getScoreForColors } from "../../utils/color";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, NextIn, Btn, PassNote } from "../ui/Kit";
import { MixGlyph } from "../ui/Glyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

export const MixGame: React.FC<GameProps> = ({ onBack, onResult, streak }) => {
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<MixRoundData>(() => setupMixRound());
  const [round, setRound] = useState(1);
  const [countdown, setCountdown] = useState<number>(5);
  const autoAdvanceTimer = useRef<number | null>(null);

  /* Next run goes straight to the countdown — no detour to instructions */
  const handleNextRound = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setRoundData(setupMixRound());
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

  const handleDone = () => {
    if (stage !== "answer") return;
    const finalScore = getScoreForColors(roundData.targetColor, roundData.userColor);
    onResult?.(finalScore >= 80); // 80 is the pass mark; passes feed the streak
    setRoundData((prev) => ({ ...prev, score: finalScore }));
    setStage("reveal");
  };

  const handleSliderChange = (key: "h" | "s" | "l", value: number) => {
    if (stage !== "answer") return;
    setRoundData((prev) => ({
      ...prev,
      userColor: { ...prev.userColor, [key]: value },
    }));
  };

  const hueGradient = "linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)";
  const satGradient = `linear-gradient(to right, hsl(${roundData.userColor.h}, 0%, ${roundData.userColor.l}%), hsl(${roundData.userColor.h}, 100%, ${roundData.userColor.l}%))`;
  const lightGradient = `linear-gradient(to right, black, hsl(${roundData.userColor.h}, ${roundData.userColor.s}%, 50%), white)`;

  const score = roundData.score ?? 0;
  /* Bands calibrated to the CIEDE2000 score: 90+ means the difference is
     barely visible; 80 is the app-wide pass mark. */
  const verdictHead =
    score >= 90 ? "Resonance." : score >= 80 ? "Nearly there." : "Different animal.";
  const verdictDetail =
    score >= 90
      ? "Your mix melts into the target."
      : score >= 80
        ? "Squint and they merge. Fine-tune the lightness next time."
        : "Compare the pair above — usually it's saturation that drifts first.";

  const status =
    stage === "stimulus" ? "Memorize it" :
    stage === "answer" ? "Rebuild it from memory" :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Round ${String(round).padStart(2, "0")}`;

  const slider = (
    id: string,
    label: string,
    value: number,
    max: number,
    unit: string,
    gradient: string,
    key: "h" | "s" | "l"
  ) => (
    <div className="flex flex-col">
      <div className="flex justify-between font-mono font-extrabold text-[11px] tracking-[0.12em] uppercase text-ink mb-2.5 tabular-nums">
        <span>{label}</span>
        <span>{value}{unit}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => handleSliderChange(key, parseInt(e.target.value))}
        className="polo-range w-full"
        style={{ background: gradient }}
        aria-label={label}
      />
    </div>
  );

  return (
    <div id="mix-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Color Mixer" status={status} onBack={onBack} streak={streak} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Color Mixer"
            steps={[
              "Study and memorize the target color — you get two seconds.",
              "Rebuild it from memory with the hue, saturation and lightness dials.",
              "Lock it in to see how close your mix really is.",
            ]}
            glyph={<span className="scale-150 inline-block"><MixGlyph /></span>}
            onComplete={() => setStage("stimulus")}
            note={<PassNote tone="color" />}
          />
        )}

        {stage === "countdown" && <Countdown onComplete={() => setStage("stimulus")} />}

        {stage === "stimulus" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
            className="flex flex-col items-center gap-6"
          >
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-mut">
              Memorize this color
            </span>
            <div
              id="mix-stimulus-box"
              className="w-52 h-52 sm:w-60 sm:h-60 rounded-3xl border-[1.5px] border-line"
              style={{ backgroundColor: hslToCss(roundData.targetColor) }}
            />
          </motion.div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center w-full gap-7">
            <div className="flex items-center gap-5">
              <div
                id="mix-interactive-swatch"
                className="w-24 h-24 rounded-2xl border-[1.5px] border-line shrink-0"
                style={{ backgroundColor: hslToCss(roundData.userColor) }}
              />
              <p className="text-[15px] text-mut max-w-[24ch] leading-relaxed">
                <b className="text-ink font-semibold">Your live mix.</b><br />
                Dial it until it matches the color you memorized.
              </p>
            </div>

            <div className="w-full max-w-sm flex flex-col gap-6">
              {slider("mix-slider-hue", "Hue", roundData.userColor.h, 360, "°", hueGradient, "h")}
              {slider("mix-slider-saturation", "Saturation", roundData.userColor.s, 100, "%", satGradient, "s")}
              {slider("mix-slider-lightness", "Lightness", roundData.userColor.l, 100, "%", lightGradient, "l")}
            </div>

            <Btn id="mix-done-btn" onClick={handleDone}>Lock it in</Btn>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-7">
            <VerdictHead
              id="mix-reveal-verdict"
              ok={score >= 80}
              headline={verdictHead}
              score={String(score)}
              scoreCaption="Match / 100"
            />

            {/* Target vs yours, side by side, seam shared */}
            <div className="flex items-stretch">
              <div className="flex flex-col items-center gap-2.5">
                <div
                  id="mix-reveal-target"
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-l-3xl"
                  style={{ backgroundColor: hslToCss(roundData.targetColor) }}
                />
                <span className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-mut">Correct</span>
              </div>
              <div className="flex flex-col items-center gap-2.5">
                <div
                  id="mix-reveal-guess"
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-r-3xl"
                  style={{ backgroundColor: hslToCss(roundData.userColor) }}
                />
                <span className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-mut">Your</span>
              </div>
            </div>

            <VerdictBody id="mix-reveal-score" detail={verdictDetail} />

            <div className="flex flex-col items-center gap-4">
              <Btn id="mix-next-btn" variant="secondary" onClick={handleNextRound}>Next color</Btn>
              <NextIn seconds={countdown} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
