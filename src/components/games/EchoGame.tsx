/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { EchoRoundData } from "../../types";
import { setupEchoRound, getEchoParamsForLevel } from "../../utils/gameLogic";
import { hslToCss, HSL } from "../../utils/color";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, Btn, Wobble } from "../ui/Kit";
import { useProgression, LivesBar, RunTimer, OutcomeNote } from "../ui/Progress";
import { RunOutcome } from "../../utils/progression";
import { EchoGlyph } from "../ui/Glyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

/* A pad rests as a pale tint of its own color and flashes to full color */
const tint = (c: HSL) => hslToCss({ h: c.h, s: Math.round(c.s * 0.45), l: 91 });

export const EchoGame: React.FC<GameProps> = ({ onBack, onResult, accentColor }) => {
  const prog = useProgression("echo");
  /* Difficulty is driven by the continuous progression ramp. Params are
     locked in per round (state, not derived each render) so the board
     can't reshape mid-round when the ramp moves after a report. */
  const [params, setParams] = useState(() => getEchoParamsForLevel(prog.ramp));

  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<EchoRoundData>(() => setupEchoRound(params));
  const [round, setRound] = useState(1);
  const [activeStimulusIndex, setActiveStimulusIndex] = useState<number>(-1);
  const [replayIndex, setReplayIndex] = useState<number>(-1);
  const [lastOutcome, setLastOutcome] = useState<RunOutcome | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  /* Next run waits for the CTA — no auto-advance. Params are re-derived
     fresh from the ramp for every new round. */
  const handleNextRound = () => {
    clearTimers();
    setTimedOut(false);
    const nextParams = getEchoParamsForLevel(prog.ramp);
    setParams(nextParams);
    setRoundData(setupEchoRound(nextParams));
    setRound((r) => r + 1);
    setActiveStimulusIndex(-1);
    setReplayIndex(-1);
    setStage("countdown");
  };

  /* Fire the sequence — flash on, brief off-gap, next pad. The off-gap is
     what makes a pad repeated twice in a row readable. */
  useEffect(() => {
    if (stage === "stimulus") {
      const { speed } = params;
      roundData.sequence.forEach((padId, i) => {
        timers.current.push(
          window.setTimeout(() => {
            setActiveStimulusIndex(padId);
            playTick();
          }, 600 + i * speed)
        );
        timers.current.push(
          window.setTimeout(() => setActiveStimulusIndex(-1), 600 + i * speed + Math.round(speed * 0.65))
        );
      });
      timers.current.push(
        window.setTimeout(() => {
          setActiveStimulusIndex(-1);
          setStage("answer");
        }, 600 + roundData.sequence.length * params.speed + 350)
      );
      return clearTimers;
    }
  }, [stage, roundData.sequence]);

  /* Reveal: replay the true sequence at the same tempo */
  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();

      const { speed } = params;
      roundData.sequence.forEach((padId, i) => {
        timers.current.push(
          window.setTimeout(() => {
            setReplayIndex(padId);
            playTick();
          }, 500 + i * speed)
        );
        timers.current.push(
          window.setTimeout(() => setReplayIndex(-1), 500 + i * speed + Math.round(speed * 0.65))
        );
      });

      return clearTimers;
    }
  }, [stage, roundData.sequence]);

  const handleSquareTap = (idx: number) => {
    if (stage !== "answer") return;
    if (!params.allowRepeat && roundData.userTaps.includes(idx)) return;

    playTick();
    triggerHaptic();

    const updatedTaps = [...roundData.userTaps, idx];
    setRoundData((prev) => ({ ...prev, userTaps: updatedTaps }));

    if (updatedTaps.length === params.seqLen) {
      const isCorrect = updatedTaps.join(",") === roundData.sequence.join(",");
      onResult?.(isCorrect); // record the result once, at answer time
      setLastOutcome(prog.report(isCorrect, isCorrect ? 100 : 0));
      setRoundData((prev) => ({ ...prev, isCorrect }));
      setStage("reveal");
    }
  };

  /* Clock ran out mid-answer — counts as a miss */
  const handleTimeout = () => {
    if (stage !== "answer") return;
    triggerHaptic();
    onResult?.(false);
    setTimedOut(true);
    setLastOutcome(prog.report(false, 0));
    setRoundData((prev) => ({ ...prev, isCorrect: false }));
    setStage("reveal");
  };

  /* Beta ask: a wrong press shouldn't be final — undo removes the last tap */
  const handleUndo = () => {
    if (stage !== "answer" || roundData.userTaps.length === 0) return;
    playTick();
    triggerHaptic();
    setRoundData((prev) => ({ ...prev, userTaps: prev.userTaps.slice(0, -1) }));
  };

  const isTapped = (id: number) => roundData.userTaps.includes(id);
  const tapOrder = (id: number) => roundData.userTaps.indexOf(id) + 1;

  const gridCols = params.boxes <= 4 ? "grid-cols-2" : params.boxes <= 9 ? "grid-cols-3" : "grid-cols-4";
  /* The board is capped rather than allowed to grow: a 9-pad board at
     300px stays square and leaves room for the caption, strip and CTA. */
  const gridWidth = params.boxes <= 4 ? "max-w-[240px]" : params.boxes <= 9 ? "max-w-[270px]" : "max-w-[300px]";

  /* A row of chips in pad colors — used to compare the correct order
     against the player's taps, works even when pads repeat */
  const seqStrip = (label: string, seq: number[], compareTo?: number[]) => (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut">{label}</span>
      <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
        {seq.map((padId, i) => {
          const wrong = compareTo !== undefined && compareTo[i] !== padId;
          const color = roundData.squares.find((sq) => sq.id === padId)?.color;
          return (
            <span
              key={i}
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-extrabold text-[11px] text-paper tabular-nums ${
                wrong ? "ring-2 ring-play-red ring-offset-2 ring-offset-paper" : ""
              }`}
              style={{ backgroundColor: color ? hslToCss(color) : "#ccc", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
    </div>
  );

  const readySteps = [
    `Watch the ${params.boxes} pads fire in a sequence of ${params.seqLen}${params.allowRepeat ? " — pads can repeat" : ""}.`,
    "Press them back in exactly that order.",
    "Every correct answer raises the level: faster, bigger, trickier.",
  ];

  return (
    <div id="echo-game-container" className="w-full flex flex-col flex-1 max-w-3xl mx-auto">
      <GameHead
        title="Repeat the Pattern"
        onBack={onBack}
        streak={prog.streak}
        points={prog.points}
        level={prog.level}
        lives={<LivesBar lives={prog.lives} />}
        onReset={prog.requestReset}
        gameId="echo"
        accent={accentColor}
      />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Repeat the Pattern"
            steps={readySteps}
            glyph={<span className="scale-150 inline-block"><EchoGlyph /></span>}
            onComplete={() => setStage("stimulus")}
            accentColor={accentColor}
          />
        )}

        {stage === "countdown" && <Countdown onComplete={() => setStage("stimulus")} />}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center gap-7">
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-mut">
              Watch the order
            </span>
            <div className={`grid ${gridCols} gap-3 w-full ${gridWidth}`}>
              {roundData.squares.map((sq) => {
                const isActive = activeStimulusIndex === sq.id;
                return (
                  <motion.div
                    key={sq.id}
                    id={`echo-stimulus-square-${sq.id}`}
                    animate={isActive ? { scale: 1.06 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="aspect-square w-full rounded-2xl border-[1.5px] border-line"
                    style={{ backgroundColor: isActive ? hslToCss(sq.color) : tint(sq.color) }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center gap-7">
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-ink tabular-nums">
              Press them back · {roundData.userTaps.length}/{params.seqLen}
            </span>
            {prog.timerSeconds !== null && (
              <RunTimer
                id="echo-run-timer"
                seconds={prog.timerSeconds}
                running={stage === "answer"}
                runKey={round}
                onExpire={handleTimeout}
              />
            )}
            <div className={`grid ${gridCols} gap-3 w-full ${gridWidth}`}>
              {roundData.squares.map((sq) => {
                const tapped = isTapped(sq.id);
                return (
                  <button
                    key={sq.id}
                    id={`echo-answer-square-${sq.id}`}
                    onClick={() => handleSquareTap(sq.id)}
                    className={`cell-pop aspect-square w-full rounded-2xl relative cursor-pointer ${
                      tapped ? "border-2 border-ink" : "border-[1.5px] border-line"
                    }`}
                    style={{ backgroundColor: tapped ? hslToCss(sq.color) : tint(sq.color) }}
                    aria-label={`Pad ${sq.id + 1}`}
                  >
                    {tapped && !params.allowRepeat && (
                      <motion.span
                        initial={{ scale: 1.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 480, damping: 18 }}
                        className="absolute top-2 left-2 w-7 h-7 rounded-full bg-ink text-paper font-mono font-extrabold text-[13px] flex items-center justify-center tabular-nums"
                      >
                        {tapOrder(sq.id)}
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Live strip of your taps so far — essential once pads repeat */}
            {params.allowRepeat && roundData.userTaps.length > 0 && seqStrip("Your taps", roundData.userTaps)}
            <button
              id="echo-undo-btn"
              onClick={handleUndo}
              disabled={roundData.userTaps.length === 0}
              className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-mut underline underline-offset-4 decoration-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Undo last
            </button>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-7">
            <VerdictHead
              id="echo-reveal-verdict"
              ok={!!roundData.isCorrect}
              headline={roundData.isCorrect ? "Perfect echo." : timedOut ? "Time ran out." : "Sequence scrambled."}
            />
            <OutcomeNote outcome={lastOutcome} />

            <Wobble active={!roundData.isCorrect} className={`w-full ${gridWidth}`}>
              <div className={`grid ${gridCols} gap-3 w-full`}>
                {roundData.squares.map((sq) => {
                  const isReplaying = replayIndex === sq.id;
                  /* A pad can hold several positions once repeats unlock */
                  const correctPos = roundData.sequence
                    .map((p, i) => (p === sq.id ? i + 1 : 0))
                    .filter(Boolean);
                  const yourPos = roundData.userTaps
                    .map((p, i) => (p === sq.id ? i + 1 : 0))
                    .filter(Boolean);
                  const matches = correctPos.join(",") === yourPos.join(",");
                  return (
                    <motion.div
                      key={sq.id}
                      id={`echo-reveal-square-${sq.id}`}
                      animate={isReplaying ? { scale: 1.06 } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      className="aspect-square w-full rounded-2xl relative border-[1.5px] border-line"
                      style={{ backgroundColor: isReplaying ? hslToCss(sq.color) : tint(sq.color) }}
                    >
                      {/* Correct order, and yours when it differs */}
                      {correctPos.length > 0 && (
                        <span className="absolute top-2 left-2 min-w-7 h-7 px-1.5 rounded-full bg-play-green text-paper font-mono font-extrabold text-[13px] flex items-center justify-center tabular-nums">
                          {correctPos.join("·")}
                        </span>
                      )}
                      {!matches && yourPos.length > 0 && (
                        <span className="absolute top-2 left-10 min-w-7 h-7 px-1.5 rounded-full bg-ink text-paper font-mono font-extrabold text-[13px] flex items-center justify-center tabular-nums">
                          {yourPos.join("·")}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </Wobble>

            <VerdictBody
              detail={
                roundData.isCorrect
                  ? "You played the pattern back exactly."
                  : "Green is the correct order, ink is yours. Watch the replay."
              }
            />

            <Btn id="echo-next-btn" variant="secondary" onClick={handleNextRound}>Next pattern</Btn>
          </div>
        )}
      </div>
      {prog.overlays}
    </div>
  );
};
