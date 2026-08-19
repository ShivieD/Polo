/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { TiltRoundData } from "../../types";
import { setupTiltRound, getTiltParams, scoreTilt, tiltDiff } from "../../utils/shapeLogic";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, Btn, PassNote } from "../ui/Kit";
import { useProgression, LivesBar, RunTimer, OutcomeNote } from "../ui/Progress";
import { RunOutcome } from "../../utils/progression";
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
export const TiltGame: React.FC<GameProps> = ({ onBack, onResult }) => {
  const prog = useProgression("tilt");
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<TiltRoundData>(() => setupTiltRound());
  const [round, setRound] = useState(1);
  const [lastOutcome, setLastOutcome] = useState<RunOutcome | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  /* Angle of the pointer at the last move event — null when not dragging */
  const lastPointerAngle = useRef<number | null>(null);

  const params = getTiltParams(prog.ramp);

  /* Next run waits for the CTA — no auto-advance */
  const handleNextRound = () => {
    setTimedOut(false);
    setRoundData(setupTiltRound());
    setRound((r) => r + 1);
    setStage("countdown");
  };

  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => setStage("answer"), params.exposure);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  useEffect(() => {
    if (stage === "reveal") playRevealInterval();
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
    const score = scoreTilt(roundData.guessAngle, roundData.trueAngle, prog.ramp);
    onResult?.(score >= 80); // 80 is the pass mark; passes feed the streak
    setLastOutcome(prog.report(score >= 80, score));
    setRoundData((prev) => ({ ...prev, score }));
    setStage("reveal");
  };

  /* Clock ran out before the lock-in — counts as a miss, scored 0 */
  const handleTimeout = () => {
    if (stage !== "answer") return;
    triggerHaptic();
    onResult?.(false);
    setTimedOut(true);
    setLastOutcome(prog.report(false, 0));
    setRoundData((prev) => ({ ...prev, score: 0 }));
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

  const truthEnds = lineEnds(roundData.trueAngle);
  const guessEnds = lineEnds(roundData.guessAngle);

  return (
    <div id="tilt-game-container" className="w-full flex flex-col flex-1 max-w-3xl mx-auto">
      <GameHead
        title="Match the Tilt"
        onBack={onBack}
        streak={prog.streak}
        points={prog.points}
        level={prog.level}
        mono
        gameId="tilt"
        lives={<LivesBar lives={prog.lives} />}
        onReset={prog.requestReset}
      />

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

            {/* The glimpse is the difficulty here, so it is shown, not just
                felt: a bar draining over exactly the exposure window, which
                shortens run by run as the ramp climbs. */}
            <div className="flex items-center gap-3 w-64 sm:w-72">
              <span className="font-mono font-extrabold text-[11px] text-mut tabular-nums shrink-0">
                {(params.exposure / 1000).toFixed(1)}s
              </span>
              <div className="flex-1 h-[10px] rounded-full border-2 border-ink overflow-hidden">
                <motion.i
                  key={`${round}-${params.exposure}`}
                  className="block h-full bg-ink"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: params.exposure / 1000, ease: "linear" }}
                />
              </div>
            </div>

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

            {prog.timerSeconds !== null && (
              <RunTimer
                id="tilt-run-timer"
                seconds={prog.timerSeconds}
                running={stage === "answer"}
                runKey={round}
                onExpire={handleTimeout}
              />
            )}

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
              headline={timedOut ? "Time ran out." : verdictHead}
              score={String(score)}
              scoreCaption="Accuracy / 100"
              mono
            />
            <OutcomeNote outcome={lastOutcome} />

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

            <Btn id="tilt-next-btn" variant="secondary" onClick={handleNextRound}>Next tilt</Btn>
          </div>
        )}
      </div>
      {prog.overlays}
    </div>
  );
};
