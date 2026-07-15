/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ShapeTallyRoundData } from "../../types";
import { setupShapeTallyRound, getShapeTallyParams } from "../../utils/shapeLogic";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, NextIn, Btn, Wobble } from "../ui/Kit";
import { ShapeTallyGlyph } from "../ui/ShapeGlyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

/* Count the Shapes — the Shapes-mode parallel of Count it all. A scatter of
   identical ink pieces flashes up whole and vanishes; count them with no
   color to chunk by. The level schedule shortens exposure and squeezes the
   answer options together. Purely greyscale. */
export const ShapeTallyGame: React.FC<GameProps> = ({ onBack, onResult, streak }) => {
  const [level, setLevel] = useState(1);
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<ShapeTallyRoundData>(() => setupShapeTallyRound(1));
  const [round, setRound] = useState(1);
  const [countdown, setCountdown] = useState<number>(5);
  const autoAdvanceTimer = useRef<number | null>(null);

  const params = getShapeTallyParams(level);
  const isUserCorrect = roundData.userSelection === roundData.trueCount;

  /* Fixed schedule: every round climbs one rung, capped at L6, and a wrong
     answer never rolls it back. Next run goes straight to the countdown. */
  const handleNextRound = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    const nextLevel = Math.min(6, level + 1);
    setLevel(nextLevel);
    setRoundData(setupShapeTallyRound(nextLevel));
    setRound((r) => r + 1);
    setStage("countdown");
    setCountdown(5);
  };

  /* The whole board lands at once, holds for the level's exposure, then
     vanishes — the shrinking window IS the difficulty */
  useEffect(() => {
    if (stage === "stimulus") {
      playTick();
      const timer = setTimeout(() => setStage("answer"), params.exposure + 400);
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

  const handleSelectOption = (num: number) => {
    if (stage !== "answer") return;
    playTick();
    triggerHaptic();
    onResult?.(num === roundData.trueCount); // record the result once, at answer time
    setRoundData((prev) => ({ ...prev, userSelection: num }));
    setStage("reveal");
  };

  const status =
    stage === "stimulus" ? "Count them" :
    stage === "answer" ? "How many?" :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Round ${String(round).padStart(2, "0")}`;

  const board = (size: string, dotScale: number, animated: boolean) => (
    <div
      id={animated ? "shapetally-scatter-container" : "shapetally-reveal-scatter"}
      className={`${size} bg-wash border-[1.5px] border-line rounded-3xl relative overflow-hidden`}
    >
      {roundData.points.map((pt, idx) => {
        const px = pt.r * dotScale;
        const piece = (
          <i
            className={`block w-full h-full bg-ink ${roundData.piece === "circle" ? "rounded-full" : "rounded-[22%]"}`}
          />
        );
        return animated ? (
          <motion.div
            key={idx}
            id={`shapetally-piece-${idx}`}
            initial={{ y: -34, scale: 0.4, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ delay: idx * 0.012, type: "spring", stiffness: 640, damping: 17 }}
            className="absolute"
            style={{
              left: `${pt.x}%`,
              top: `${pt.y}%`,
              width: `${px}px`,
              height: `${px}px`,
              marginLeft: `${-px / 2}px`,
              marginTop: `${-px / 2}px`,
            }}
          >
            {piece}
          </motion.div>
        ) : (
          <div
            key={idx}
            id={`shapetally-reveal-piece-${idx}`}
            className="absolute"
            style={{
              left: `${pt.x}%`,
              top: `${pt.y}%`,
              width: `${px}px`,
              height: `${px}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {piece}
          </div>
        );
      })}
    </div>
  );

  return (
    <div id="shapetally-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Count the Shapes" status={status} onBack={onBack} streak={streak} mono level={level} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Count the Shapes"
            steps={[
              "A scatter of identical pieces lands all at once.",
              "Count them before they vanish — the window shrinks every round.",
              "Pick how many there were. The wrong options creep closer too.",
            ]}
            glyph={<span className="scale-150 inline-block"><ShapeTallyGlyph /></span>}
            onComplete={() => setStage("stimulus")}
            mono
          />
        )}

        {stage === "countdown" && <Countdown onComplete={() => setStage("stimulus")} mono />}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center gap-6">
            <span className="font-sans font-bold text-[17px] text-ink">Count the pieces</span>
            {board("w-72 h-72 sm:w-80 sm:h-80", 2.6, true)}
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center gap-8">
            <span className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-ink text-center">
              How many pieces landed?
            </span>
            <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
              {roundData.options.map((opt, i) => (
                <motion.button
                  key={opt}
                  id={`shapetally-option-${opt}`}
                  onClick={() => handleSelectOption(opt)}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 380, damping: 21 }}
                  className="btn-press !rounded-2xl bg-paper font-mono font-extrabold text-xl py-4 tabular-nums cursor-pointer"
                >
                  {opt}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-7">
            <VerdictHead
              id="shapetally-reveal-verdict"
              ok={isUserCorrect}
              headline={
                isUserCorrect
                  ? "Exact count."
                  : `Off by ${Math.abs((roundData.userSelection ?? 0) - roundData.trueCount)}.`
              }
              score={String(roundData.trueCount)}
              scoreCaption="True count"
              mono
            />

            <Wobble active={!isUserCorrect}>{board("w-52 h-52", 2.1, false)}</Wobble>

            <VerdictBody
              detail={
                isUserCorrect
                  ? `${roundData.trueCount} pieces with no color to chunk by — sharp counting. The window shrinks next round.`
                  : `There were ${roundData.trueCount}. Group them into clusters of three or four as they land.`
              }
            />

            <div className="flex flex-col items-center gap-4">
              <Btn id="shapetally-next-btn" variant="secondary" onClick={handleNextRound}>
                {isUserCorrect ? "Next scatter" : "Try again"}
              </Btn>
              <NextIn seconds={countdown} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
