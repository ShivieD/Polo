/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ShapeTallyRoundData } from "../../types";
import { setupShapeTallyRound, getShapeTallyParams } from "../../utils/shapeLogic";
import { GameHead, Ready, Countdown, VerdictHead, Btn, Wobble } from "../ui/Kit";
import { useProgression, LivesBar, RunTimer, OutcomeNote } from "../ui/Progress";
import { RunOutcome } from "../../utils/progression";
import { ShapeTallyGlyph } from "../ui/ShapeGlyphs";
import { playTick, playDrop, playRevealInterval, triggerHaptic } from "../../utils/audio";

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
export const ShapeTallyGame: React.FC<GameProps> = ({ onBack, onResult }) => {
  const prog = useProgression("shapetally");
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<ShapeTallyRoundData>(() => setupShapeTallyRound(prog.ramp));
  const [round, setRound] = useState(1);
  const [visibleCount, setVisibleCount] = useState<number>(0);
  const [lastOutcome, setLastOutcome] = useState<RunOutcome | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const params = getShapeTallyParams(prog.ramp);
  const isUserCorrect = roundData.userSelection === roundData.trueCount;

  /* Next run waits for the CTA — no auto-advance */
  const handleNextRound = () => {
    setTimedOut(false);
    setRoundData(setupShapeTallyRound(prog.ramp));
    setRound((r) => r + 1);
    setVisibleCount(0);
    setStage("countdown");
  };

  /* Pieces drop one at a time, a tick per landing — the same cadence as
     Count it All. Passing tightens the drop tempo. */
  useEffect(() => {
    if (stage === "stimulus") {
      setVisibleCount(0);
      let popped = 0;
      const total = roundData.points.length;
      const interval = setInterval(() => {
        if (popped < total) {
          popped++;
          setVisibleCount(popped);
          playDrop();
        } else {
          clearInterval(interval);
          setTimeout(() => setStage("answer"), 850);
        }
      }, params.popSpeed);

      return () => clearInterval(interval);
    }
  }, [stage, roundData.points.length, params.popSpeed]);

  useEffect(() => {
    if (stage === "reveal") playRevealInterval();
  }, [stage]);

  const handleSelectOption = (num: number) => {
    if (stage !== "answer") return;
    playTick();
    triggerHaptic();
    onResult?.(num === roundData.trueCount); // record the result once, at answer time
    setLastOutcome(prog.report(num === roundData.trueCount, num === roundData.trueCount ? 100 : 0));
    setRoundData((prev) => ({ ...prev, userSelection: num }));
    setStage("reveal");
  };

  /* Clock ran out with no pick — counts as a miss */
  const handleTimeout = () => {
    if (stage !== "answer") return;
    triggerHaptic();
    onResult?.(false);
    setTimedOut(true);
    setLastOutcome(prog.report(false, 0));
    setStage("reveal");
  };

  const board = (size: string, dotScale: number, animated: boolean) => (
    <div
      id={animated ? "shapetally-scatter-container" : "shapetally-reveal-scatter"}
      className={`${size} bg-wash border-[1.5px] border-line rounded-3xl relative overflow-hidden`}
    >
      {roundData.points.map((pt, idx) => {
        const px = pt.r * dotScale;
        const visible = !animated || idx < visibleCount;
        const piece = (
          <i
            className={`block w-full h-full bg-ink ${roundData.piece === "circle" ? "rounded-full" : "rounded-[22%]"}`}
          />
        );
        return animated ? (
          <motion.div
            key={idx}
            id={`shapetally-piece-${idx}`}
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
    <div id="shapetally-game-container" className="w-full flex flex-col flex-1 max-w-3xl mx-auto">
      <GameHead
        title="Count the Shapes"
        onBack={onBack}
        streak={prog.streak}
        points={prog.points}
        level={prog.level}
        mono
        lives={<LivesBar lives={prog.lives} />}
        onReset={prog.requestReset}
        gameId="shapetally"
      />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Count the Shapes"
            steps={[
              "Identical pieces drop onto the board one by one.",
              "Count them as they land — passing quickens the drops.",
              "Pick how many landed. The wrong options creep closer too.",
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
            {prog.timerSeconds !== null && (
              <RunTimer
                id="shapetally-run-timer"
                seconds={prog.timerSeconds}
                running={stage === "answer"}
                runKey={round}
                onExpire={handleTimeout}
              />
            )}
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
          <div className="flex flex-col items-center gap-5">
            <VerdictHead
              id="shapetally-reveal-verdict"
              ok={isUserCorrect}
              headline={
                isUserCorrect
                  ? "Exact count."
                  : timedOut
                    ? "Time ran out."
                    : `Off by ${Math.abs((roundData.userSelection ?? 0) - roundData.trueCount)}.`
              }
              score={String(roundData.trueCount)}
              scoreCaption="True count"
              mono
            />
            <OutcomeNote outcome={lastOutcome} />

            {/* Board alone, centred. The commentary line that used to sit
                beside it pushed the column off-centre and only restated the
                true count already shown in the verdict. */}
            <Wobble active={!isUserCorrect} className="shrink-0">{board("w-48 h-48", 2.0, false)}</Wobble>

            <Btn id="shapetally-next-btn" variant="secondary" onClick={handleNextRound}>
              {isUserCorrect ? "Next scatter" : "Try again"}
            </Btn>
          </div>
        )}
      </div>
      {prog.overlays}
    </div>
  );
};
