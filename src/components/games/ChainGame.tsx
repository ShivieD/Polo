/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChainRoundData, ShapeKind } from "../../types";
import { setupChainRound, getChainParams, CHAIN_STEP_MS } from "../../utils/shapeLogic";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, Btn, Wobble } from "../ui/Kit";
import { useProgression, LivesBar, RunTimer, OutcomeNote } from "../ui/Progress";
import { RunOutcome } from "../../utils/progression";
import { ChainGlyph, ShapeSvg } from "../ui/ShapeGlyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

/* Repeat the Chain — the Shapes-mode parallel of Repeat the Pattern.
   Shapes land one by one along a row of positions; play them back in order
   from the palette. The level schedule grows the row, then lets shapes
   repeat, then draws them all from one look-alike family. Greyscale only. */
export const ChainGame: React.FC<GameProps> = ({ onBack, onResult }) => {
  const prog = useProgression("chain");
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<ChainRoundData>(() => setupChainRound(prog.ramp));
  const [round, setRound] = useState(1);
  /* Which position is currently flashing its shape (stimulus + replay) */
  const [liveIndex, setLiveIndex] = useState<number>(-1);
  const [replaying, setReplaying] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<RunOutcome | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const timers = useRef<number[]>([]);

  const params = getChainParams(prog.ramp);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  /* Next run waits for the CTA — no auto-advance */
  const handleNextRound = () => {
    clearTimers();
    setTimedOut(false);
    setRoundData(setupChainRound(prog.ramp));
    setRound((r) => r + 1);
    setLiveIndex(-1);
    setReplaying(false);
    setStage("countdown");
  };

  /* Fire the sequence — each position flashes its shape, with an off-gap so
     a repeated shape stays readable */
  useEffect(() => {
    if (stage === "stimulus") {
      roundData.sequence.forEach((_, i) => {
        timers.current.push(window.setTimeout(() => { setLiveIndex(i); playTick(); }, 600 + i * CHAIN_STEP_MS));
        timers.current.push(
          window.setTimeout(() => setLiveIndex(-1), 600 + i * CHAIN_STEP_MS + Math.round(CHAIN_STEP_MS * 0.75))
        );
      });
      timers.current.push(
        window.setTimeout(() => {
          setLiveIndex(-1);
          setStage("answer");
        }, 600 + roundData.sequence.length * CHAIN_STEP_MS + 350)
      );
      return clearTimers;
    }
  }, [stage, roundData.sequence]);

  /* Reveal: replay the true sequence at the same tempo, then rest with the
     full chain visible */
  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();
      setReplaying(true);

      roundData.sequence.forEach((_, i) => {
        timers.current.push(window.setTimeout(() => { setLiveIndex(i); playTick(); }, 800 + i * CHAIN_STEP_MS));
      });
      timers.current.push(
        window.setTimeout(() => {
          setLiveIndex(-1);
          setReplaying(false);
        }, 800 + roundData.sequence.length * CHAIN_STEP_MS + 300)
      );

      return clearTimers;
    }
  }, [stage, roundData.sequence]);

  const handlePaletteTap = (kind: ShapeKind) => {
    if (stage !== "answer") return;
    if (roundData.userSeq.length >= params.len) return;

    playTick();
    triggerHaptic();

    const updated = [...roundData.userSeq, kind];
    setRoundData((prev) => ({ ...prev, userSeq: updated }));

    if (updated.length === params.len) {
      const isCorrect = updated.join(",") === roundData.sequence.join(",");
      onResult?.(isCorrect); // record the result once, at answer time
      setLastOutcome(prog.report(isCorrect, isCorrect ? 100 : 0));
      setRoundData((prev) => ({ ...prev, isCorrect }));
      setStage("reveal");
    }
  };

  /* Clock ran out mid-rebuild — counts as a miss, same as a wrong link */
  const handleTimeout = () => {
    if (stage !== "answer") return;
    triggerHaptic();
    onResult?.(false);
    setTimedOut(true);
    setLastOutcome(prog.report(false, 0));
    setRoundData((prev) => ({ ...prev, isCorrect: false }));
    setStage("reveal");
  };

  const handleUndo = () => {
    if (stage !== "answer" || roundData.userSeq.length === 0) return;
    setRoundData((prev) => ({ ...prev, userSeq: prev.userSeq.slice(0, -1) }));
  };

  /* The row of positions. `filled` decides what a slot shows when it isn't
     the one currently flashing. */
  const slotRow = (filled: (ShapeKind | null)[], flashing: number, idPrefix: string) => (
    <div className="flex justify-center gap-2 w-full">
      {Array.from({ length: params.len }).map((_, i) => {
        const shape = flashing === i ? roundData.sequence[i] : filled[i];
        return (
          <motion.div
            key={i}
            id={`${idPrefix}-${i}`}
            animate={flashing === i ? { scale: 1.08 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className={`aspect-square flex-1 max-w-[64px] rounded-xl p-1.5 ${
              flashing === i ? "border-2 border-ink bg-paper" : "border-[1.5px] border-line bg-wash"
            }`}
          >
            {shape && <ShapeSvg spec={{ kind: shape }} />}
          </motion.div>
        );
      })}
    </div>
  );

  const empties = Array.from({ length: params.len }, () => null);
  const userFilled = Array.from({ length: params.len }, (_, i) => roundData.userSeq[i] ?? null);

  return (
    <div id="chain-game-container" className="w-full flex flex-col flex-1 max-w-3xl mx-auto">
      <GameHead
        title="Repeat the Chain"
        onBack={onBack}
        streak={prog.streak}
        points={prog.points}
        mono
        gameId="chain"
        lives={<LivesBar lives={prog.lives} />}
        onReset={prog.requestReset}
      />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Repeat the Chain"
            steps={[
              `Watch ${params.len} shapes land along the row, one per position${params.allowRepeat ? " — shapes can repeat" : ""}.`,
              "Tap the shapes from the palette in that exact order, left to right.",
              "Get it right and the chain grows longer and trickier; a slip replays the same length.",
            ]}
            glyph={<span className="scale-150 inline-block"><ChainGlyph /></span>}
            onComplete={() => setStage("stimulus")}
            mono
          />
        )}

        {stage === "countdown" && <Countdown onComplete={() => setStage("stimulus")} mono />}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center gap-7">
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-mut">
              Watch the order
            </span>
            {slotRow(empties, liveIndex, "chain-stimulus-slot")}
          </div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center gap-8">
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-ink tabular-nums">
              Rebuild the chain · {roundData.userSeq.length}/{params.len}
            </span>

            {/* Countdown starts only once the chain has finished landing */}
            {prog.timerSeconds !== null && (
              <RunTimer
                id="chain-run-timer"
                seconds={prog.timerSeconds}
                running={stage === "answer"}
                runKey={round}
                onExpire={handleTimeout}
              />
            )}

            {slotRow(userFilled, -1, "chain-answer-slot")}

            {/* The palette — every shape used this round, outlined because
                it's touchable */}
            <div className="flex justify-center flex-nowrap gap-3 w-full max-w-3xl">
              {roundData.pool.map((kind) => (
                <button
                  key={kind}
                  id={`chain-palette-${kind}`}
                  onClick={() => handlePaletteTap(kind)}
                  className="cell-pop w-16 h-16 rounded-2xl border-2 border-ink bg-paper p-2.5 cursor-pointer"
                  aria-label={`Shape ${kind}`}
                >
                  <ShapeSvg spec={{ kind }} />
                </button>
              ))}
            </div>

            <button
              id="chain-undo-btn"
              onClick={handleUndo}
              disabled={roundData.userSeq.length === 0}
              className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-mut underline underline-offset-4 decoration-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Undo last
            </button>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-7">
            <VerdictHead
              id="chain-reveal-verdict"
              ok={!!roundData.isCorrect}
              headline={roundData.isCorrect ? "Perfect chain." : timedOut ? "Time ran out." : "A link slipped."}
              mono
            />
            <OutcomeNote outcome={lastOutcome} />

            <Wobble active={!roundData.isCorrect} className="w-full">
              <div className="grid grid-cols-2 gap-6 w-full">
                {/* The truth replays at the same tempo, then rests visible */}
                <div className="flex flex-col items-center gap-2 w-full">
                  <span className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut">
                    Correct
                  </span>
                  {slotRow(replaying ? empties : [...roundData.sequence], replaying ? liveIndex : -1, "chain-reveal-true")}
                </div>

                {/* Your answer alongside — mismatched links dashed mid-grey */}
                <div className="flex flex-col items-center gap-2 w-full">
                  <span className="font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase text-mut">
                    Your
                  </span>
                  <div className="flex justify-center gap-2 w-full">
                    {roundData.userSeq.map((kind, i) => {
                      const hit = roundData.sequence[i] === kind;
                      return (
                        <div
                          key={i}
                          id={`chain-reveal-your-${i}`}
                          className={`aspect-square flex-1 max-w-[64px] rounded-xl p-1.5 bg-paper ${
                            hit ? "border-[3px] border-ink" : "border-2 border-dashed border-mut"
                          }`}
                        >
                          <ShapeSvg spec={{ kind }} color={hit ? undefined : "var(--color-mut)"} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Wobble>

            <VerdictBody
              detail={
                roundData.isCorrect
                  ? "You rebuilt the chain link for link. Watch it climb."
                  : "Solid outlines are the links you hit; dashed mid-grey marks the slips. Watch the replay."
              }
            />

            <Btn id="chain-next-btn" variant="secondary" onClick={handleNextRound}>Next chain</Btn>
          </div>
        )}
      </div>
      {prog.overlays}
    </div>
  );
};
