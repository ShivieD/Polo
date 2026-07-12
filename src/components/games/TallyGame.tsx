/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { TallyRoundData, TallyMode, TallyShape } from "../../types";
import { setupTallyRound } from "../../utils/gameLogic";
import { GameHead, Ready, VerdictHead, VerdictBody, Btn, Wobble, Countdown } from "../ui/Kit";
import { TallyGlyph } from "../ui/Glyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

/* Dots are physical pieces in the four playable primaries */
const DOT_COLORS = ["#ff4b3e", "#ffc400", "#2d6cf6", "#1fbf66"];

const UNLOCK_KEY = "polo-tally-shapes-unlocked";
const UNLOCK_AT = 20; // correctly count a board of 20+ to unlock shapes mode

/* A piece is a circle, a square, or a triangle in one of the primaries */
const PieceShape: React.FC<{ shape?: TallyShape; color: string }> = ({ shape, color }) =>
  shape === "triangle" ? (
    <svg viewBox="0 0 100 100" className="w-full h-full block" aria-hidden="true">
      <polygon points="50,6 96,92 4,92" fill={color} />
    </svg>
  ) : (
    <div
      className={`w-full h-full ${shape === "square" ? "rounded-[22%]" : "rounded-full"}`}
      style={{ backgroundColor: color }}
    />
  );

/* Little illustrations for the mode picker cards */
const DotsIllo: React.FC = () => (
  <span aria-hidden="true" className="w-16 h-16 shrink-0 rounded-xl bg-paper border-[1.5px] border-line grid grid-cols-3 gap-1.5 p-3">
    {Array.from({ length: 9 }).map((_, i) => (
      <i key={i} className="rounded-full bg-play-yellow" />
    ))}
  </span>
);

const ShapesIllo: React.FC = () => (
  <span aria-hidden="true" className="w-16 h-16 shrink-0 rounded-xl bg-paper border-[1.5px] border-line grid grid-cols-2 gap-1.5 p-3">
    <i className="rounded-full bg-play-green" />
    <i className="rounded-[4px] bg-play-yellow" />
    <svg viewBox="0 0 100 100" className="w-full h-full block">
      <polygon points="50,8 96,92 4,92" fill="#2d6cf6" />
    </svg>
    <i className="rounded-[4px] bg-play-red" />
  </span>
);

/* Radio-style check indicator, filled when the card is selected */
const CheckDot: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    aria-hidden="true"
    className={`ml-auto w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
      on ? "bg-play-yellow" : "border-2 border-line"
    }`}
  >
    {on && (
      <svg width="16" height="13" viewBox="0 0 16 13">
        <path d="M1.5 6.5 6 11 14.5 1.5" fill="none" stroke="#111116" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </span>
);

export const TallyGame: React.FC<GameProps> = ({ onBack, onResult, streak }) => {
  const [stage, setStage] = useState<"getReady" | "stimulus" | "answer" | "reveal">("getReady");
  const [mode, setMode] = useState<TallyMode>("dots");
  const [shapesUnlocked, setShapesUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(UNLOCK_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [dotsRun, setDotsRun] = useState<number>(1);
  const [shapesRun, setShapesRun] = useState<number>(1);
  const [counting, setCounting] = useState(false); // countdown inside the mode picker
  const [roundData, setRoundData] = useState<TallyRoundData>(() => setupTallyRound(1, "dots"));
  const [visibleDotsCount, setVisibleDotsCount] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(5);
  const autoAdvanceTimer = useRef<number | null>(null);

  const runForMode = (m: TallyMode) => (m === "dots" ? dotsRun : shapesRun);
  const roundNumber = runForMode(mode);
  const isUserCorrect = roundData.userSelection === roundData.trueCount;

  const handleNextRound = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    let nextRun = roundNumber;
    if (isUserCorrect) {
      nextRun = roundNumber + 1;
      if (mode === "dots") setDotsRun(nextRun);
      else setShapesRun(nextRun);
    }
    setRoundData(setupTallyRound(nextRun, mode));
    setVisibleDotsCount(0);
    setJustUnlocked(false);
    setStage("getReady");
    setCountdown(5);
  };

  /* Called from the mode picker — regenerate the round for the chosen mode */
  const startRun = (chosen: TallyMode) => {
    setMode(chosen);
    setRoundData(setupTallyRound(runForMode(chosen), chosen));
    setVisibleDotsCount(0);
    setCounting(true);
  };

  /* Pop pieces one by one. Dots mode speeds up with the run level;
     shapes mode keeps a steady tempo — the mix is the challenge. */
  useEffect(() => {
    if (stage === "stimulus") {
      setVisibleDotsCount(0);
      let dotsPopped = 0;
      const totalDots = roundData.points.length;
      const popSpeed =
        roundData.mode === "shapes"
          ? 150
          : Math.max(30, Math.round(250 / (1 + (roundNumber - 1) * 0.45)));

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
  }, [stage, roundNumber, roundData.points.length, roundData.mode]);

  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();
      onResult?.(isUserCorrect);

      /* Nailing a 20+ board unlocks shape counting */
      if (isUserCorrect && roundData.mode === "dots" && roundData.trueCount >= UNLOCK_AT && !shapesUnlocked) {
        setShapesUnlocked(true);
        setJustUnlocked(true);
        try {
          localStorage.setItem(UNLOCK_KEY, "1");
        } catch {
          /* storage unavailable — unlock stays session-only */
        }
      }

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

  const targetLabel = roundData.targetShape ? `${roundData.targetShape}s` : "pieces";

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
        const px = pt.r * (animated ? 2.6 : dotScale);
        return animated ? (
          /* Pieces drop, bounce once, settle */
          <motion.div
            key={idx}
            id={`tally-circle-${idx}`}
            initial={false}
            animate={visible ? { y: 0, scale: 1, opacity: 1 } : { y: -34, scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 640, damping: 17 }}
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
            <PieceShape shape={pt.shape} color={color} />
          </motion.div>
        ) : (
          <div
            key={idx}
            id={`tally-reveal-circle-${idx}`}
            className="absolute"
            style={{
              left: `${pt.x}%`,
              top: `${pt.y}%`,
              width: `${px}px`,
              height: `${px}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <PieceShape shape={pt.shape} color={color} />
          </div>
        );
      })}
    </div>
  );

  /* Mode picker — appears once shape counting is unlocked */
  const modePicker = counting ? (
    <Countdown
      onComplete={() => {
        setCounting(false);
        setStage("stimulus");
      }}
    />
  ) : (
    <motion.div
      id="tally-mode-picker"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="flex flex-col items-center text-center max-w-2xl mx-auto py-8 select-none"
    >
      <div className="mb-7 flex justify-center"><span className="scale-150 inline-block"><TallyGlyph /></span></div>
      <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-ink mb-3">Count the Dots</h2>
      <p className="text-[16px] text-mut leading-relaxed mb-7">Pick your challenge for this run.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-9">
        <button
          id="tally-mode-dots"
          onClick={() => { playTick(); triggerHaptic(); setMode("dots"); }}
          className={`flex items-center gap-4 text-left rounded-2xl border-2 p-4 cursor-pointer transition-colors ${
            mode === "dots" ? "border-play-yellow bg-[#FFF8E1]" : "border-line bg-paper hover:border-mut"
          }`}
          aria-pressed={mode === "dots"}
        >
          <DotsIllo />
          <span className="flex-1 min-w-0">
            <span className="font-display font-extrabold text-[16px] text-ink block mb-1">Dots</span>
            <span className="text-[14px] text-mut leading-snug block">
              One kind of piece. More of them, faster, every run.
            </span>
          </span>
          <CheckDot on={mode === "dots"} />
        </button>
        <button
          id="tally-mode-shapes"
          onClick={() => { playTick(); triggerHaptic(); setMode("shapes"); }}
          className={`flex items-center gap-4 text-left rounded-2xl border-2 p-4 cursor-pointer transition-colors ${
            mode === "shapes" ? "border-play-yellow bg-[#FFF8E1]" : "border-line bg-paper hover:border-mut"
          }`}
          aria-pressed={mode === "shapes"}
        >
          <ShapesIllo />
          <span className="flex-1 min-w-0">
            <span className="font-display font-extrabold text-[16px] text-ink block mb-1">Shapes</span>
            <span className="text-[14px] text-mut leading-snug block">
              Circles, squares & triangles mixed — count just one kind.
            </span>
          </span>
          <CheckDot on={mode === "shapes"} />
        </button>
      </div>

      <Btn id="tally-start-btn" onClick={() => startRun(mode)}>Start run</Btn>
    </motion.div>
  );

  return (
    <div id="tally-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Count the Dots" status={status} onBack={onBack} streak={streak} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          shapesUnlocked ? (
            modePicker
          ) : (
            <Ready
              name="Count the Dots"
              steps={
                dotsRun === 1
                  ? [
                      "Pieces drop onto the board one by one.",
                      "Count them as they land.",
                      "Pick how many landed — correct runs get faster and busier.",
                      `Conquer a board of ${UNLOCK_AT}+ to unlock shape counting.`,
                    ]
                  : [
                      `Run ${dotsRun} — faster and busier. Keep counting.`,
                      `Conquer a board of ${UNLOCK_AT}+ to unlock shape counting.`,
                    ]
              }
              glyph={<span className="scale-150 inline-block"><TallyGlyph /></span>}
              onComplete={() => setStage("stimulus")}
            />
          )
        )}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center gap-6">
            <span className="font-sans font-bold text-[17px] text-ink flex items-center gap-2.5">
              {roundData.mode === "shapes" ? (
                <>
                  Count only the {targetLabel}
                  <span className="w-5 h-5 inline-block"><PieceShape shape={roundData.targetShape} color="#111116" /></span>
                </>
              ) : (
                "Count the pieces"
              )}
            </span>
            {board("w-72 h-72 sm:w-80 sm:h-80", 2.6, true)}
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center gap-8">
            <span className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-ink flex items-center gap-3 text-center">
              How many {targetLabel} landed?
              {roundData.mode === "shapes" && (
                <span className="w-6 h-6 inline-block shrink-0"><PieceShape shape={roundData.targetShape} color="#111116" /></span>
              )}
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
            <VerdictHead
              id="tally-reveal-verdict"
              ok={isUserCorrect}
              headline={
                isUserCorrect
                  ? "Exact count."
                  : `Off by ${Math.abs((roundData.userSelection ?? 0) - roundData.trueCount)}.`
              }
            />

            <Wobble active={!isUserCorrect}>{board("w-52 h-52", 2.1, false)}</Wobble>

            <VerdictBody
              detail={
                justUnlocked
                  ? `You conquered a ${roundData.trueCount}-piece board — Shapes mode is now unlocked. Pick it on the next round screen.`
                  : isUserCorrect
                    ? roundData.mode === "shapes"
                      ? `${roundData.trueCount} ${targetLabel} — sharp filtering. Next run mixes in more pieces.`
                      : `${roundData.trueCount} pieces — your counting radar is calibrated. Next run gets faster.`
                    : roundData.mode === "shapes"
                      ? `There were ${roundData.trueCount} ${targetLabel}. The mix stays put until you nail it.`
                      : `There were ${roundData.trueCount}. The speed stays put until you nail it.`
              }
              score={String(roundData.trueCount)}
              scoreCaption={roundData.mode === "shapes" ? `True ${targetLabel}` : "True count"}
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
