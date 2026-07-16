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
  /* Color-mode games only: that instrument's own accent hex. In dark mode
     a primary CTA's border/shadow/label take this color instead of the
     default play-yellow, so the button matches the game it belongs to. */
  accent?: string;
}

export const Btn: React.FC<BtnProps> = ({
  variant = "primary",
  accent,
  className = "",
  style,
  children,
  onClick,
  ...rest
}) => {
  const base = "font-sans font-bold text-[15px] tracking-[0.01em] px-7 py-3 cursor-pointer select-none";
  const skin =
    variant === "primary"
      ? "btn-press btn-accent"
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
      style={accent ? { ...style, "--btn-accent-color": accent } as React.CSSProperties : style}
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
  /* Shapes mode: greyscale chrome — the streak chip trades yellow for ink */
  mono?: boolean;
  /* Shapes mode: the in-session level marker, top-right. Soft opacity fade
     when it advances — no celebration. */
  level?: number;
}> = ({ title, status, onBack, streak, id, mono = false, level }) => (
  <div id={id} className="flex items-center gap-4 flex-wrap mb-8">
    <BackBtn onClick={onBack} />
    <h2 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-ink">{title}</h2>
    <span className="ml-auto flex items-center gap-3">
      {typeof streak === "number" && streak > 0 && (
        <span
          id="game-streak-chip"
          className={`font-mono font-extrabold text-[11px] tracking-[0.1em] uppercase rounded-full px-2.5 py-1 tabular-nums ${
            mono ? "bg-ink text-paper" : "chip-accent"
          }`}
        >
          Streak {streak}
        </span>
      )}
      <span className="font-mono font-extrabold text-[12px] tracking-[0.1em] text-mut uppercase tabular-nums">
        {status}
      </span>
      {typeof level === "number" && (
        <motion.span
          key={level}
          id="game-level-marker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="font-mono font-extrabold text-[12px] tracking-[0.1em] text-ink uppercase tabular-nums"
        >
          L{level}
        </motion.span>
      )}
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

export const Loader: React.FC<{ label?: string; mono?: boolean }> = ({ label, mono = false }) => (
  <div className="flex flex-col items-center gap-7">
    <div className={`polo-loader ${mono ? "polo-loader-mono" : ""}`} role="img" aria-label="Loading">
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

export const Countdown: React.FC<{ onComplete: () => void; label?: string; mono?: boolean }> = ({
  onComplete,
  label = "Eyes ready",
  mono = false,
}) => {
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
          isGo ? `text-[64px] ${mono ? "text-ink" : "text-play-green"}` : "text-[96px] text-ink"
        }`}
      >
        {seq[step]}
      </div>
      <div className="w-[156px] h-[13px] border-2 border-ink rounded-full overflow-hidden">
        <i
          key={step}
          className={`block h-full ${
            isGo ? `w-full ${mono ? "bg-ink" : "bg-play-green"}` : `polo-drain ${mono ? "bg-ink" : "bg-play-yellow"}`
          }`}
        />
      </div>
      <span className="font-mono font-extrabold text-[11px] tracking-[0.18em] text-mut uppercase">{label}</span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Ready screen — instructions, then Start round → Countdown           */
/* ------------------------------------------------------------------ */

/* Numbered timeline — circled step numbers joined by a single vertical line,
   one instruction per step beside it. Each step (except the last) draws a
   connector from its own circle down to the next circle, anchored to the
   row's box edges rather than to flex height — so the line is continuous and
   the same on every screen no matter how far any step's text wraps. There is
   no line above the first circle or below the last. */
export const StepsTimeline: React.FC<{ steps: string[]; className?: string }> = ({ steps, className = "" }) => (
  <ol className={`flex flex-col text-left ${className}`}>
    {steps.map((step, i) => {
      const last = i === steps.length - 1;
      return (
        <li key={i} className={`relative flex gap-4 ${last ? "" : "pb-7"}`}>
          {/* connector: circle-bottom (top-8 = circle height) → next circle-top (li bottom edge) */}
          {!last && <span aria-hidden="true" className="absolute left-[15px] top-8 bottom-0 w-[2px] bg-ink" />}
          <span className="relative z-10 w-8 h-8 shrink-0 rounded-full border-2 border-ink bg-paper font-mono font-extrabold text-[13px] flex items-center justify-center tabular-nums">
            {i + 1}
          </span>
          <span className="text-[16px] text-ink leading-relaxed pt-[3px]">{step}</span>
        </li>
      );
    })}
  </ol>
);

/* The pass-mark note for score-based instruments: an inverted chip that
   stays greyscale in Shapes mode ("mono") and may go yellow in dark mode
   for Color-mode games ("color"). */
export const PassNote: React.FC<{ tone?: "mono" | "color" }> = ({ tone = "mono" }) => (
  <span
    className={`polo-note ${tone === "color" ? "polo-note-color" : ""} font-mono font-extrabold text-[10.5px] tracking-[0.1em] uppercase rounded-2xl px-4 py-2.5 leading-relaxed max-w-xs`}
  >
    Note: you pass a round at 80+ — passes count toward your streak.
  </span>
);

export const Ready: React.FC<{
  name: string;
  steps: string[];
  glyph?: React.ReactNode;
  onComplete: () => void;
  ctaLabel?: string;
  /* When true the CTA fires onComplete directly, skipping the countdown —
     used when the next screen is another choice (e.g. the mode picker). */
  immediate?: boolean;
  /* Shapes mode: greyscale CTA and countdown */
  mono?: boolean;
  /* Optional slot between the steps and the CTA — e.g. the PassNote chip */
  note?: React.ReactNode;
  /* Color-mode games: that instrument's accent, carried onto the CTA */
  accentColor?: string;
}> = ({ name, steps, glyph, onComplete, ctaLabel = "Start round", immediate = false, mono = false, note, accentColor }) => {
  const [counting, setCounting] = useState(false);

  if (counting) return <Countdown onComplete={onComplete} mono={mono} />;

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
      <StepsTimeline steps={steps} className={`max-w-sm ${note ? "mb-6" : "mb-10"}`} />
      {note && <div className="mt-5 mb-8 flex justify-center">{note}</div>}
      <Btn
        id="get-ready-start-btn"
        variant={mono ? "secondary" : "primary"}
        accent={mono ? undefined : accentColor}
        onClick={() => (immediate ? onComplete() : setCounting(true))}
      >
        {ctaLabel}
      </Btn>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Verdict — the moment after an answer. Pops in with verdict weight   */
/* ------------------------------------------------------------------ */

/* The verdict is split so the result board can sit in the middle:
   VerdictHead (pill + headline + score) stamps in ABOVE the board,
   VerdictBody (the explanation) sits below it, and NextIn (the countdown)
   goes under the CTA. */
export const VerdictHead: React.FC<{
  ok: boolean;
  headline: string;
  score?: string;
  scoreCaption?: string;
  id?: string;
  /* Shapes mode: the verdict carried by weight instead of hue — solid ink
     pill for a hit, dashed outline for a miss. */
  mono?: boolean;
}> = ({ ok, headline, score, scoreCaption, id, mono = false }) => (
  <motion.div
    id={id}
    initial={{ scale: 1.35, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 380, damping: 22 }}
    className="flex flex-col items-center text-center"
  >
    <span
      className={`font-mono font-extrabold text-[11px] tracking-[0.16em] uppercase px-3.5 py-1.5 rounded-full ${
        mono
          ? ok
            ? "bg-ink text-paper"
            : "bg-paper text-ink border-2 border-dashed border-mut"
          : ok
            ? "bg-play-green text-paper"
            : "bg-play-red text-paper"
      }`}
    >
      {ok ? "Correct!" : "Miss"}
    </span>
    <h3 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-ink mt-3">{headline}</h3>
    {score !== undefined && (
      <div className="font-mono font-extrabold text-6xl leading-none tabular-nums text-ink mt-5">{score}</div>
    )}
    {scoreCaption && (
      <div className="font-mono font-medium text-[11px] tracking-[0.16em] uppercase text-mut mt-2">{scoreCaption}</div>
    )}
  </motion.div>
);

export const VerdictBody: React.FC<{ detail: string; id?: string }> = ({ detail, id }) => (
  <motion.p
    id={id}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 340, damping: 24, delay: 0.08 }}
    className="text-[15px] text-mut max-w-sm leading-relaxed text-center"
  >
    {detail}
  </motion.p>
);

/* The auto-advance countdown line — lives under the CTA */
export const NextIn: React.FC<{ seconds: number }> = ({ seconds }) => (
  <span className="font-mono font-medium text-[12px] tracking-[0.14em] uppercase text-mut tabular-nums">
    Next round in {seconds}s
  </span>
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
