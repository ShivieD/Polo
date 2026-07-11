/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { TallyRoundData } from "../../types";
import { setupTallyRound } from "../../utils/gameLogic";
import { GameHead, Ready, Verdict, Btn, Wobble } from "../ui/Kit";
import { TallyGlyph } from "../ui/Glyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onPlayed?: () => void;
}

/* Dots are physical pieces in the four playable primaries */
const DOT_COLORS = ["#ff4b3e", "#ffc400", "#2d6cf6", "#1fbf66"];

export const TallyGame: React.FC<GameProps> = ({ onBack, onPlayed }) => {
  const [stage, setStage] = useState<"getReady" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [roundData, setRoundData] = useState<TallyRoundData>(() => setupTallyRound(1));
  const [visibleDotsCount, setVisibleDotsCount] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(5);
  const autoAdvanceTimer = useRef<number | null>(null);

  const handleNextRound = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    const wasCorrect = roundData.userSelection === roundData.trueCount;
    const nextRound = wasCorrect ? roundNumber + 1 : roundNumber;
    setRoundNumber(nextRound);
    setRoundData(setupTallyRound(nextRound));
    setVisibleDotsCount(0);
    setStage("getReady");
    setCountdown(5);
  };

  /* Pop dots one by one; speed scales with the run level (unchanged logic) */
  useEffect(() => {
    if (stage === "stimulus") {
      setVisibleDotsCount(0);
      let dotsPopped = 0;
      const totalDots = roundData.points.length;
      const popSpeed = Math.max(30, Math.round(250 / (1 + (roundNumber - 1) * 0.45)));

      const interval = setInterval(() => {
        if (dotsPopped < totalDots) {
          dotsPopped++;
          setVisibleDotsCount(dotsPopped);
          playTick();
        } else {
          clearInterval(interval);
          setTimeout(() => setStage("answer"), 850);
        }
      }, popSpeed);

      return () => clearInterval(interval);
    }
  }, [stage, roundNumber, roundData.points.length]);

  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();
      onPlayed?.();

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
    setRoundData((prev) => ({ ...prev, userSelection: num }));
    setStage("reveal");
  };

  const isUserCorrect = roundData.userSelection === roundData.trueCount;

  const status =
    stage === "stimulus" ? "Count them" :
    stage === "answer" ? "How many?" :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Run ${String(roundNumber).padStart(2, "0")}`;

  const board = (size: string, dotScale: number, animated: boolean) => (
    <div
      id={animated ? "tally-scatter-container" : "tally-reveal-scatter"}
      className={`${size} bg-wash border-[1.5px] border-line rounded-3xl relative overflow-hidden`}
    >
      {roundData.points.map((pt, idx) => {
        const visible = !animated || idx < visibleDotsCount;
        const color = DOT_COLORS[idx % DOT_COLORS.length];
        return animated ? (
          /* Pieces drop, bounce once, settle */
          <motion.div
            key={idx}
            id={`tally-circle-${idx}`}
            initial={false}
            animate={visible ? { y: 0, scale: 1, opacity: 1 } : { y: -34, scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 640, damping: 17 }}
            className="absolute rounded-full"
            style={{
              left: `${pt.x}%`,
              top: `${pt.y}%`,
              width: `${pt.r * 2.6}px`,
              height: `${pt.r * 2.6}px`,
              marginLeft: `${-pt.r * 1.3}px`,
              marginTop: `${-pt.r * 1.3}px`,
              backgroundColor: color,
            }}
          />
        ) : (
          <div
            key={idx}
            id={`tally-reveal-circle-${idx}`}
            className="absolute rounded-full"
            style={{
              left: `${pt.x}%`,
              top: `${pt.y}%`,
              width: `${pt.r * dotScale}px`,
              height: `${pt.r * dotScale}px`,
              transform: "translate(-50%, -50%)",
              backgroundColor: color,
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div id="tally-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Count the Dots" status={status} onBack={onBack} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Count the Dots"
            instructions={
              roundNumber === 1
                ? "Pieces drop onto the board one by one. Count them as they land, then answer. Every correct run makes them faster and more numerous."
                : `Run ${roundNumber} — faster and busier. Keep counting.`
            }
            glyph={<span className="scale-150 inline-block"><TallyGlyph /></span>}
            onComplete={() => setStage("stimulus")}
          />
        )}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center gap-6">
            <span className="font-mono font-extrabold text-[11px] tracking-[0.18em] uppercase text-mut tabular-nums">
              Count the pieces
            </span>
            {board("w-72 h-72 sm:w-80 sm:h-80", 2.6, true)}
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center gap-8">
            <span className="font-mono font-extrabold text-[11px] tracking-[0.18em] uppercase text-ink">
              How many pieces landed?
            </span>
            <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
              {roundData.options.map((opt, i) => (
                <motion.button
                  key={opt}
                  id={`tally-option-${opt}`}
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
          <div className="flex flex-col items-center gap-8">
            <Wobble active={!isUserCorrect}>{board("w-52 h-52", 2.1, false)}</Wobble>

            <Verdict
              id="tally-reveal-verdict"
              ok={isUserCorrect}
              headline={
                isUserCorrect
                  ? "Exact count."
                  : `Off by ${Math.abs((roundData.userSelection ?? 0) - roundData.trueCount)}.`
              }
              detail={
                isUserCorrect
                  ? `${roundData.trueCount} pieces — your counting radar is calibrated. Next run gets faster.`
                  : `There were ${roundData.trueCount}. The speed stays put until you nail it.`
              }
              score={String(roundData.trueCount)}
              scoreCaption="True count"
              nextIn={countdown}
            />

            <Btn id="tally-next-btn" variant="secondary" onClick={handleNextRound}>
              {isUserCorrect ? "Next run" : "Try again"}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
};
