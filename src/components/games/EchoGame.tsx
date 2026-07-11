/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { EchoRoundData } from "../../types";
import { setupEchoRound } from "../../utils/gameLogic";
import { hslToCss, HSL } from "../../utils/color";
import { GameHead, Ready, Verdict, Btn, Wobble } from "../ui/Kit";
import { EchoGlyph } from "../ui/Glyphs";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onPlayed?: () => void;
}

/* A pad rests as a pale tint of its own color and flashes to full color */
const tint = (c: HSL) => hslToCss({ h: c.h, s: Math.round(c.s * 0.45), l: 91 });

export const EchoGame: React.FC<GameProps> = ({ onBack, onPlayed }) => {
  const [stage, setStage] = useState<"getReady" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<EchoRoundData>(() => setupEchoRound());
  const [round, setRound] = useState(1);
  const [activeStimulusIndex, setActiveStimulusIndex] = useState<number>(-1);
  const [replayIndex, setReplayIndex] = useState<number>(-1);
  const [countdown, setCountdown] = useState<number>(5);
  const autoAdvanceTimer = useRef<number | null>(null);

  const handleNextRound = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setRoundData(setupEchoRound());
    setRound((r) => r + 1);
    setActiveStimulusIndex(-1);
    setReplayIndex(-1);
    setStage("getReady");
    setCountdown(5);
  };

  /* Fire the sequence (unchanged timing) */
  useEffect(() => {
    if (stage === "stimulus") {
      let step = 0;
      const playStep = () => {
        if (step < roundData.sequence.length) {
          setActiveStimulusIndex(roundData.sequence[step]);
          playTick();
          step++;
          setTimeout(playStep, 600);
        } else {
          setActiveStimulusIndex(-1);
          setTimeout(() => setStage("answer"), 350);
        }
      };
      const startTimer = setTimeout(playStep, 600);
      return () => clearTimeout(startTimer);
    }
  }, [stage, roundData.sequence]);

  /* Reveal: replay the true sequence at tempo */
  useEffect(() => {
    if (stage === "reveal") {
      playRevealInterval();
      onPlayed?.();

      const interval = setInterval(() => setCountdown((p) => Math.max(0, p - 1)), 1000);

      let replayStep = 0;
      const playReplay = () => {
        if (replayStep < roundData.sequence.length) {
          setReplayIndex(roundData.sequence[replayStep]);
          playTick();
          replayStep++;
          setTimeout(playReplay, 600);
        } else {
          setReplayIndex(-1);
        }
      };
      const replayTimer = setTimeout(playReplay, 500);

      const autoTimer = setTimeout(handleNextRound, 5400);
      autoAdvanceTimer.current = autoTimer as unknown as number;

      return () => {
        clearInterval(interval);
        clearTimeout(replayTimer);
        clearTimeout(autoTimer);
      };
    }
  }, [stage, roundData.sequence]);

  const handleSquareTap = (idx: number) => {
    if (stage !== "answer") return;
    if (roundData.userTaps.includes(idx)) return;

    playTick();
    triggerHaptic();

    const updatedTaps = [...roundData.userTaps, idx];
    setRoundData((prev) => ({ ...prev, userTaps: updatedTaps }));

    if (updatedTaps.length === 4) {
      const isCorrect = updatedTaps.join(",") === roundData.sequence.join(",");
      setRoundData((prev) => ({ ...prev, isCorrect }));
      setStage("reveal");
    }
  };

  const isTapped = (id: number) => roundData.userTaps.includes(id);
  const tapOrder = (id: number) => roundData.userTaps.indexOf(id) + 1;

  const status =
    stage === "stimulus" ? "Watch the pads" :
    stage === "answer" ? `Your turn · ${roundData.userTaps.length}/4` :
    stage === "reveal" ? `Next in ${countdown}s` :
    `Round ${String(round).padStart(2, "0")}`;

  return (
    <div id="echo-game-container" className="w-full flex flex-col flex-1 max-w-xl mx-auto">
      <GameHead title="Repeat the Pattern" status={status} onBack={onBack} />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Repeat the Pattern"
            instructions="Four pads fire in a sequence. Watch the order, then press them back in exactly that order."
            glyph={<span className="scale-150 inline-block"><EchoGlyph /></span>}
            onComplete={() => setStage("stimulus")}
          />
        )}

        {stage === "stimulus" && (
          <div className="flex flex-col items-center gap-7">
            <span className="font-mono font-extrabold text-[11px] tracking-[0.18em] uppercase text-mut">
              Watch the order
            </span>
            <div className="grid grid-cols-2 gap-3 w-full max-w-[300px]">
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
            <span className="font-mono font-extrabold text-[11px] tracking-[0.18em] uppercase text-ink tabular-nums">
              Press them back · {roundData.userTaps.length}/4
            </span>
            <div className="grid grid-cols-2 gap-3 w-full max-w-[300px]">
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
                    {tapped && (
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
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-9">
            <Wobble active={!roundData.isCorrect} className="w-full max-w-[300px]">
              <div className="grid grid-cols-2 gap-3 w-full">
                {roundData.squares.map((sq) => {
                  const isReplaying = replayIndex === sq.id;
                  const seqPos = roundData.sequence.indexOf(sq.id) + 1;
                  const yourPos = roundData.userTaps.indexOf(sq.id) + 1;
                  return (
                    <motion.div
                      key={sq.id}
                      id={`echo-reveal-square-${sq.id}`}
                      animate={isReplaying ? { scale: 1.06 } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      className="aspect-square w-full rounded-2xl relative border-[1.5px] border-line"
                      style={{ backgroundColor: isReplaying ? hslToCss(sq.color) : tint(sq.color) }}
                    >
                      {/* True order, and yours when it differs */}
                      <span className="absolute top-2 left-2 w-7 h-7 rounded-full bg-play-green text-paper font-mono font-extrabold text-[13px] flex items-center justify-center tabular-nums">
                        {seqPos}
                      </span>
                      {yourPos !== seqPos && (
                        <span className="absolute top-2 left-10 w-7 h-7 rounded-full bg-ink text-paper font-mono font-extrabold text-[13px] flex items-center justify-center tabular-nums">
                          {yourPos}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </Wobble>

            <Verdict
              id="echo-reveal-verdict"
              ok={!!roundData.isCorrect}
              headline={roundData.isCorrect ? "Perfect echo." : "Sequence scrambled."}
              detail={
                roundData.isCorrect
                  ? "You played the pattern back exactly."
                  : "Green is the true order, ink is yours. Watch the replay."
              }
              nextIn={countdown}
            />

            <Btn id="echo-next-btn" variant="secondary" onClick={handleNextRound}>Next pattern</Btn>
          </div>
        )}
      </div>
    </div>
  );
};
