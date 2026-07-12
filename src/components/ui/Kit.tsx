/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { playTick, triggerHaptic } from "../../utils/audio";

/* ------------------------------------------------------------------ */
/* Buttons — pill geometry with physical press depth                   */
/* ------------------------------------------------------------------ */

type BtnVariant = "primary" | "secondary" | "ghost";

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
}

export const Btn: React.FC<BtnProps> = ({ variant = "primary", className = "", children, onClick, ...rest }) => {
  const base = "font-sans font-bold text-[15px] tracking-[0.01em] px-7 py-3 cursor-pointer select-none";
  const skin =
    variant === "primary"
      ? "btn-press bg-play-yellow text-ink"
      : variant === "secondary"
        ? "btn-press bg-paper text-ink"
        : "bg-transparent text-ink underline underline-offset-4 decoration-2 hover:decoration-play-blue";

  return (
    <button
      {...rest}
      onClick={(e) => {
        playTick();
        triggerHaptic();
        onClick?.(e);
      }}
      className={`${base} ${skin} ${className}`}
    >
      {children}
    </button>
  );
};

/* Round back button with a heavyweight drawn arrow */
export const BackBtn: React.FC<{ onClick: () => void; id?: string }> = ({ onClick, id }) => (
  <button
    id={id}
    onClick={() => {
      playTick();
      triggerHaptic();
      onClick();
    }}
    aria-label="Back to menu"
    className="btn-press w-11 h-11 !rounded-full bg-paper text-ink flex items-center justify-center shrink-0 cursor-pointer"
  >
    <svg width="19" height="16" viewBox="0 0 19 16" aria-hidden="true">
      <path d="M17 8H3M8.2 2 2 8l6.2 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
);

/* ------------------------------------------------------------------ */
/* Game screen chrome                                                  */
/* ------------------------------------------------------------------ */

export const GameHead: React.FC<{
  title: string;
  status: string;
  onBack: () => void;
  streak?: number;
  id?: string;
}> = ({ title, status, onBack, streak, id }) => (
  <div id={id} className="flex items-center gap-4 flex-wrap mb-8">
    <BackBtn onClick={onBack} />
    <h2 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-ink">{title}</h2>
    <span className="ml-auto flex items-center gap-3">
      {typeof streak === "number" && streak > 0 && (
        <span
          id="game-streak-chip"
          className="font-mono font-extrabold text-[11px] tracking-[0.1em] uppercase bg-play-yellow text-ink rounded-full px-2.5 py-1 tabular-nums"
        >
          Streak {streak}
        </span>
      )}
      <span className="font-mono font-extrabold text-[12px] tracking-[0.1em] text-mut uppercase tabular-nums">
        {status}
      </span>
    </span>
  </div>
);

/* White card with hairline border — the resting surface for game boards */
export const Panel: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({
  children,
  className = "",
  id,
}) => (
  <div id={id} className={`bg-paper border-[1.5px] border-line rounded-3xl ${className}`}>
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/* Loader — the identity mark playing musical chairs                   */
/* ------------------------------------------------------------------ */

export const Loader: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex flex-col items-center gap-7">
    <div className="polo-loader" role="img" aria-label="Loading">
      <i /><i /><i /><i />
    </div>
    {label && (
      <span className="font-mono font-extrabold text-[11px] tracking-[0.18em] text-mut uppercase">{label}</span>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* Countdown — 3, 2, 1, GO. Digits stamp; a charge bar drains the beat */
/* ------------------------------------------------------------------ */

const BEAT_MS = 860;

export const Countdown: React.FC<{ onComplete: () => void; label?: string }> = ({ onComplete, label = "Eyes ready" }) => {
  const seq = ["3", "2", "1", "GO"];
  const [step, setStep] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    playTick();
    triggerHaptic();
    if (step < seq.length - 1) {
      const t = setTimeout(() => setStep((s) => s + 1), BEAT_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (!done.current) {
        done.current = true;
        onComplete();
      }
    }, 620);
    return () => clearTimeout(t);
  }, [step]);

  const isGo = seq[step] === "GO";

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-10 select-none" aria-label={`Countdown: ${seq[step]}`}>
      <div
        key={step}
        className={`polo-stamp font-mono font-extrabold leading-none tabular-nums h-[100px] flex items-center ${
          isGo ? "text-[64px] text-play-green" : "text-[96px] text-ink"
        }`}
      >
        {seq[step]}
      </div>
      <div className="w-[156px] h-[13px] border-2 border-ink rounded-full overflow-hidden">
        <i
          key={step}
          className={`block h-full ${isGo ? "bg-play-green w-full" : "bg-play-yellow polo-drain"}`}
        />
      </div>
      <span className="font-mono font-extrabold text-[11px] tracking-[0.18em] text-mut uppercase">{label}</span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Ready screen — instructions, then Start round → Countdown           */
/* ------------------------------------------------------------------ */

/* Numbered timeline — circled step numbers joined by a vertical line,
   with one instruction per step beside it */
export const StepsTimeline: React.FC<{ steps: string[]; className?: string }> = ({ steps, className = "" }) => (
  <ol className={`relative flex flex-col gap-6 text-left ${className}`}>
    {steps.length > 1 && <i aria-hidden="true" className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-line" />}
    {steps.map((step, i) => (
      <li key={i} className="relative flex items-start gap-4">
        <span className="w-8 h-8 shrink-0 rounded-full border-2 border-ink bg-paper font-mono font-extrabold text-[13px] flex items-center justify-center tabular-nums z-10">
          {i + 1}
        </span>
        <span className="text-[16px] text-ink leading-relaxed pt-[3px]">{step}</span>
      </li>
    ))}
  </ol>
);

export const Ready: React.FC<{
  name: string;
  steps: string[];
  glyph?: React.ReactNode;
  onComplete: () => void;
}> = ({ name, steps, glyph, onComplete }) => {
  const [counting, setCounting] = useState(false);

  if (counting) return <Countdown onComplete={onComplete} />;

  return (
    <motion.div
      id="get-ready-view"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="flex flex-col items-center text-center max-w-md mx-auto py-8 select-none"
    >
      {glyph && <div className="mb-7 flex justify-center">{glyph}</div>}
      <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-ink mb-7">{name}</h2>
      <StepsTimeline steps={steps} className="max-w-sm mb-10" />
      <Btn id="get-ready-start-btn" onClick={() => setCounting(true)}>
        Start round
      </Btn>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Verdict — the moment after an answer. Pops in with verdict weight   */
/* ------------------------------------------------------------------ */

export const Verdict: React.FC<{
  ok: boolean;
  headline: string;
  detail: string;
  score?: string;
  scoreCaption?: string;
  nextIn?: number;
  id?: string;
}> = ({ ok, headline, detail, score, scoreCaption, nextIn, id }) => (
  <motion.div
    id={id}
    initial={{ scale: 1.35, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 380, damping: 22 }}
    className="flex flex-col items-center text-center gap-1"
  >
    <span
      className={`font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase px-3.5 py-1.5 rounded-full mb-3 ${
        ok ? "bg-play-green text-paper" : "bg-play-red text-paper"
      }`}
    >
      {ok ? "Correct!" : "Miss"}
    </span>
    {score !== undefined && (
      <div className="font-mono font-extrabold text-6xl leading-none tabular-nums text-ink">{score}</div>
    )}
    {scoreCaption && (
      <div className="font-mono font-medium text-[11px] tracking-[0.16em] uppercase text-mut mt-1">{scoreCaption}</div>
    )}
    <h3 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-ink mt-3">{headline}</h3>
    <p className="text-[15px] text-mut max-w-sm leading-relaxed mt-1">{detail}</p>
    {nextIn !== undefined && (
      <span className="font-mono font-medium text-[12px] tracking-[0.14em] uppercase text-mut mt-4 tabular-nums">
        Next round in {nextIn}s
      </span>
    )}
  </motion.div>
);

/* Streak dots — session progress, green = done */
export const Streak: React.FC<{ total: number; done: number; className?: string }> = ({ total, done, className = "" }) => (
  <div className={`flex gap-1.5 items-center ${className}`} aria-label={`${done} of ${total} done`}>
    {Array.from({ length: total }).map((_, i) => (
      <i key={i} className={`w-2.5 h-2.5 rounded-[3px] ${i < done ? "bg-play-green" : "bg-line"}`} />
    ))}
  </div>
);

/* Wobble wrapper: shakes its children when mounted with `active` true.
   Pass a width class — as a flex item it otherwise shrinks to fit. */
export const Wobble: React.FC<{ active: boolean; children: React.ReactNode; className?: string }> = ({
  active,
  children,
  className = "",
}) => (
  <motion.div
    animate={active ? { x: [0, -7, 7, -4, 0] } : { x: 0 }}
    transition={{ duration: 0.35 }}
    className={className}
  >
    {children}
  </motion.div>
);
