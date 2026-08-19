/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { BetweenRoundData } from "../../types";
import { setupBetweenRound, sampleStops } from "../../utils/gameLogic";
import { hslToCss } from "../../utils/color";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, Btn, PassNote } from "../ui/Kit";
import { useProgression, LivesBar, RunTimer, OutcomeNote } from "../ui/Progress";
import { RunOutcome } from "../../utils/progression";
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

export const BetweenGame: React.FC<GameProps> = ({ onBack, onResult, accentColor }) => {
  const prog = useProgression("between");
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<BetweenRoundData>(() => setupBetweenRound(prog.ramp));
  const [round, setRound] = useState(1);
  const [lastOutcome, setLastOutcome] = useState<RunOutcome | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const isDragging = useRef(false);

  /* Next run waits for the CTA — no auto-advance */
  const handleNextRound = () => {
    setTimedOut(false);
    setRoundData(setupBetweenRound(prog.ramp));
    setRound((r) => r + 1);
    setStage("countdown");
  };

  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => setStage("answer"), 2000);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  useEffect(() => {
    if (stage === "reveal") playRevealInterval();
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
    setLastOutcome(prog.report(score >= 80, score));
    setRoundData((prev) => ({ ...prev, score }));
    setStage("reveal");
  };

  /* Clock ran out with no lock-in — counts as a zero-score miss */
  const handleTimeout = () => {
    if (stage !== "answer") return;
    triggerHaptic();
    onResult?.(false);
    setTimedOut(true);
    setLastOutcome(prog.report(false, 0));
    setRoundData((prev) => ({ ...prev, score: 0 }));
    setStage("reveal");
  };

  const targetColor = sampleStops(roundData.stops, roundData.truePosition);

  /* Sampled densely rather than handed to CSS as stops, so the painted ramp
     matches the short-hue-path HSL maths the answer is scored against. */
  const gradientStops = Array.from({ length: 41 }, (_, i) =>
    hslToCss(sampleStops(roundData.stops, i / 40))
  );
  const gradientStyle = `linear-gradient(to right, ${gradientStops.join(", ")})`;

  const score = roundData.score ?? 0;
  const verdictHead =
    timedOut ? "Time ran out." : score >= 95 ? "Surgical." : score >= 80 ? "Sharp eye." : score >= 60 ? "Close." : "Off the mark.";
  const verdictDetail =
    score >= 95
      ? "That is elite hue discrimination."
      : score >= 80
        ? "Within a whisker of true."
        : score >= 60
          ? "Watch the lightness, not just the hue."
          : "The gradient lies to everyone at first. Again.";

  return (
    <div id="between-game-container" className="w-full flex flex-col flex-1 max-w-3xl mx-auto">
      <GameHead
        title="Find the Spot"
        onBack={onBack}
        streak={prog.streak}
        points={prog.points}
        level={prog.level}
        lives={<LivesBar lives={prog.lives} />}
        onReset={prog.requestReset}
        gameId="between"
        accent={accentColor}
      />

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
              className="w-full max-w-xl h-24 rounded-full border-[1.5px] border-line"
              style={{ background: gradientStyle }}
            />
          </motion.div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center w-full gap-7">
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-ink">
              Where does it live?
            </span>
            {prog.timerSeconds !== null && (
              <RunTimer
                id="between-run-timer"
                seconds={prog.timerSeconds}
                running={stage === "answer"}
                runKey={round}
                onExpire={handleTimeout}
              />
            )}
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
            <div className="w-full max-w-xl">
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
            <OutcomeNote outcome={lastOutcome} />

            {/* Gradient with staggered pins: Correct above, Your below — the
                tags can never collide, even on a perfect guess */}
            <div className="w-full max-w-xl pt-9 pb-8">
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

            <Btn id="between-next-btn" variant="secondary" onClick={handleNextRound}>Next color</Btn>
          </div>
        )}
      </div>
      {prog.overlays}
    </div>
  );
};
