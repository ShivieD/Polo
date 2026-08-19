/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getPlayer } from "../../utils/leaderboard";
import { motion, AnimatePresence } from "motion/react";
import { GameId } from "../../types";
import {
  GameProgress,
  RunOutcome,
  getProgress,
  reportRun,
  buyLife,
  rescueStreak,
  resetLiveState,
  lifeCost,
  countdownFor,
  difficultyRamp,
  MAX_LIVES,
  MAX_LEVEL,
  RUNS_PER_LEVEL,
} from "../../utils/progression";
import { submitStats } from "../../utils/leaderboard";
import { playTick, triggerHaptic } from "../../utils/audio";
import { Btn } from "./Kit";

/* ------------------------------------------------------------------ */
/* LivesBar — up to five toy blocks, filled = lives in reserve          */
/* ------------------------------------------------------------------ */

export const LivesBar: React.FC<{ lives: number; id?: string }> = ({ lives, id }) => (
  <span id={id} className="flex items-center gap-1" aria-label={`${lives} lives left`} title={`${lives} lives`}>
    {Array.from({ length: MAX_LIVES }, (_, i) => (
      <i
        key={i}
        className={`w-2.5 h-2.5 rounded-[3px] ${i < lives ? "bg-ink" : "border-[1.5px] border-line"}`}
      />
    ))}
  </span>
);

/* ------------------------------------------------------------------ */
/* RunTimer — one run's countdown. Restart by changing `runKey`.        */
/* ------------------------------------------------------------------ */

export const RunTimer: React.FC<{
  seconds: number;
  running: boolean;
  onExpire: () => void;
  runKey: string | number;
  id?: string;
}> = ({ seconds, running, onExpire, runKey, id }) => {
  const [left, setLeft] = useState(seconds);
  const expired = useRef(false);

  useEffect(() => {
    setLeft(seconds);
    expired.current = false;
  }, [runKey, seconds]);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setLeft((prev) => {
        const next = Math.max(0, prev - 0.25);
        if (next === 0 && !expired.current) {
          expired.current = true;
          clearInterval(iv);
          setTimeout(onExpire, 0);
        }
        return next;
      });
    }, 250);
    return () => clearInterval(iv);
  }, [running, runKey]);

  const frac = seconds > 0 ? left / seconds : 0;
  const urgent = left <= 10;

  return (
    <div id={id} className="w-full max-w-xs flex items-center gap-3 select-none" aria-label={`${Math.ceil(left)} seconds left`}>
      <span className={`font-mono font-extrabold text-[13px] tabular-nums ${urgent ? "text-play-red" : "text-ink"}`}>
        0:{String(Math.ceil(left)).padStart(2, "0")}
      </span>
      <div className="flex-1 h-[10px] border-2 border-ink rounded-full overflow-hidden">
        <i
          className={`block h-full ${urgent ? "bg-play-red" : "bg-ink"}`}
          style={{ width: `${frac * 100}%`, transition: "width 0.25s linear" }}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Modal scaffolding                                                   */
/* ------------------------------------------------------------------ */

const Overlay: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => (
  <motion.div
    id={id}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[60] flex items-center justify-center p-6"
    style={{ background: "color-mix(in srgb, var(--color-ink-fixed) 55%, transparent)" }}
  >
    <motion.div
      initial={{ scale: 0.85, y: 18 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 24 }}
      className="bg-paper border-2 border-ink rounded-3xl px-7 py-8 max-w-sm w-full flex flex-col items-center text-center gap-5"
    >
      {children}
    </motion.div>
  </motion.div>
);

/* ------------------------------------------------------------------ */
/* useProgression — the one hook a game wires in                        */
/* ------------------------------------------------------------------ */

interface Toast {
  level: number;
  mastered?: boolean;
  gameName?: string;
}

export interface Progression {
  level: number;
  lives: number;
  streak: number;
  points: number;
  maxLevel: number;
  /* Continuous difficulty: level + fraction of the current cycle cleared */
  ramp: number;
  timerSeconds: number | null;
  report: (passed: boolean, points: number) => RunOutcome;
  requestReset: () => void;
  /* Render this once, anywhere inside the game screen */
  overlays: React.ReactNode;
}


/* ------------------------------------------------------------------ */
/* Certificate canvas — rendered to a PNG for download/share            */
/* ------------------------------------------------------------------ */

const BRAND = ["#ff4b3e", "#ffc400", "#2d6cf6", "#1fbf66"];

/* Mix a brand hex toward white (f > 0) or black (f < 0) */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const t = f > 0 ? 255 : 0;
  const a = Math.abs(f);
  const ch = (v: number) => Math.round(v + (t - v) * a);
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/* The Polo mark: 2x2 rounded squares at the favicon's proportions */
function poloMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, side: number, gap: number) {
  const r = side * 0.25;
  const block = side * 2 + gap;
  const x0 = cx - block / 2;
  const y0 = cy - block / 2;
  const pos = [[0, 0], [side + gap, 0], [0, side + gap], [side + gap, side + gap]];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = BRAND[i];
    ctx.beginPath();
    ctx.roundRect(x0 + pos[i][0], y0 + pos[i][1], side, side, r);
    ctx.fill();
  }
}

/* Isometric cube — three rhombi cut from a hexagon, lit top-left */
function isoCube(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  const hx = s * 0.866;
  const top: [number, number] = [cx, cy - s];
  const ur: [number, number] = [cx + hx, cy - s / 2];
  const lr: [number, number] = [cx + hx, cy + s / 2];
  const bot: [number, number] = [cx, cy + s];
  const ll: [number, number] = [cx - hx, cy + s / 2];
  const ul: [number, number] = [cx - hx, cy - s / 2];
  const c: [number, number] = [cx, cy];
  const face = (pts: [number, number][], fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  };
  face([ul, top, ur, c], shade(color, 0.22));
  face([ul, c, bot, ll], shade(color, -0.10));
  face([c, ur, lr, bot], shade(color, -0.34));
}

function dotField(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, cols: number, rows: number, step: number
) {
  ctx.fillStyle = "rgba(17,17,22,0.07)";
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      ctx.beginPath();
      ctx.arc(x + i * step, y + j * step, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCertificate(
  canvas: HTMLCanvasElement,
  gameName: string,
  playerName: string,
  level: number,
  points: number,
  bestStreak: number
) {
  const W = 1400, H = 900, cx = W / 2;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const INK = "#111116";
  const MUT = "#8b8b84";

  ctx.fillStyle = "#f7f6f3";
  ctx.fillRect(0, 0, W, H);

  /* Frame: thin outer rule, thick inner rule */
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(25, 25, W - 50, H - 50, 22); ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(43, 43, W - 86, H - 86, 14); ctx.stroke();

  dotField(ctx, 1108, 108, 6, 5, 17);
  dotField(ctx, 138, 742, 4, 4, 17);
  isoCube(ctx, 148, 214, 30, BRAND[3]);
  isoCube(ctx, 1258, 232, 27, BRAND[0]);
  isoCube(ctx, 135, 604, 24, BRAND[1]);
  isoCube(ctx, 1268, 660, 29, BRAND[2]);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  /* Identity */
  poloMark(ctx, cx, 108, 27, 4);
  ctx.fillStyle = INK;
  ctx.font = "900 30px system-ui, -apple-system, sans-serif";
  ctx.letterSpacing = "-0.5px";
  ctx.fillText("POLO", cx, 178);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = MUT;
  ctx.font = "600 15px ui-monospace, 'SF Mono', monospace";
  ctx.letterSpacing = "5px";
  ctx.fillText("CERTIFICATE OF ACHIEVEMENT", cx, 222);
  ctx.letterSpacing = "0px";

  /* The instrument, shrunk to fit if the name runs long */
  const title = gameName.toUpperCase();
  let titleSize = 70;
  ctx.font = `900 ${titleSize}px system-ui, -apple-system, sans-serif`;
  while (ctx.measureText(title).width > W - 380 && titleSize > 34) {
    titleSize -= 2;
    ctx.font = `900 ${titleSize}px system-ui, -apple-system, sans-serif`;
  }
  ctx.fillStyle = INK;
  ctx.letterSpacing = "-1px";
  ctx.fillText(title, cx, 300);
  ctx.letterSpacing = "0px";

  ctx.strokeStyle = "rgba(17,17,22,0.16)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx - 128, 333); ctx.lineTo(cx - 52, 333); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 52, 333); ctx.lineTo(cx + 128, 333); ctx.stroke();
  ctx.fillStyle = BRAND[1];
  ctx.font = "22px serif";
  ctx.fillText("\u2605 \u2605 \u2605", cx, 341);

  ctx.fillStyle = MUT;
  ctx.font = "600 14px ui-monospace, 'SF Mono', monospace";
  ctx.letterSpacing = "4px";
  ctx.fillText("ALL LEVELS COMPLETED", cx, 386);
  ctx.letterSpacing = "0px";

  /* Name plate */
  const name = playerName || "Anonymous";
  ctx.font = "900 52px system-ui, -apple-system, sans-serif";
  const cardW = Math.max(ctx.measureText(name).width + 130, 380);
  const cardH = 92, cardY = 414, cardX = cx - cardW / 2;
  ctx.fillStyle = "#edeae4";
  ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 20); ctx.fill();
  ctx.strokeStyle = "rgba(17,17,22,0.10)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 20); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.fillText(name, cx, cardY + cardH / 2 + 3);
  ctx.textBaseline = "alphabetic";

  /* Stats — three columns split by brand dots */
  const labelY = 588, valueY = 630;
  const colL = cx - 300, colR = cx + 300;
  const label = (t: string, x: number) => {
    ctx.fillStyle = MUT;
    ctx.font = "600 12px ui-monospace, 'SF Mono', monospace";
    ctx.letterSpacing = "2.5px";
    ctx.fillText(t, x, labelY);
    ctx.letterSpacing = "0px";
  };
  const value = (t: string, x: number) => {
    ctx.fillStyle = INK;
    ctx.font = "900 36px system-ui, -apple-system, sans-serif";
    ctx.fillText(t, x, valueY);
  };

  label("LEVEL", colL);
  value(String(level), colL);
  label("BEST STREAK", colR);
  value(String(bestStreak), colR);

  /* Points: number and unit measured, then laid out as one centred pair */
  label("POINTS", cx);
  const numStr = points.toLocaleString();
  ctx.font = "900 36px system-ui, -apple-system, sans-serif";
  const wNum = ctx.measureText(numStr).width;
  ctx.font = "700 15px ui-monospace, 'SF Mono', monospace";
  ctx.letterSpacing = "1.5px";
  const wUnit = ctx.measureText("PTS").width;
  ctx.letterSpacing = "0px";
  const GAP = 11;
  const startX = cx - (wNum + GAP + wUnit) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = "900 36px system-ui, -apple-system, sans-serif";
  ctx.fillText(numStr, startX, valueY);
  ctx.fillStyle = MUT;
  ctx.font = "700 15px ui-monospace, 'SF Mono', monospace";
  ctx.letterSpacing = "1.5px";
  ctx.fillText("PTS", startX + wNum + GAP, valueY);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "center";

  ctx.fillStyle = BRAND[0];
  ctx.beginPath(); ctx.arc(cx - 158, valueY - 12, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BRAND[2];
  ctx.beginPath(); ctx.arc(cx + 158, valueY - 12, 5, 0, Math.PI * 2); ctx.fill();

  /* Footer */
  ctx.strokeStyle = "rgba(17,17,22,0.12)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(190, 700); ctx.lineTo(W - 190, 700); ctx.stroke();

  const dateX = 400, baseY = 782;
  ctx.fillStyle = INK;
  ctx.font = "700 19px ui-monospace, 'SF Mono', monospace";
  ctx.letterSpacing = "1px";
  ctx.fillText(
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase(),
    dateX, baseY
  );
  ctx.letterSpacing = "0px";
  ctx.strokeStyle = "rgba(17,17,22,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(dateX - 150, baseY + 17); ctx.lineTo(dateX + 150, baseY + 17); ctx.stroke();
  ctx.fillStyle = MUT;
  ctx.font = "600 13px ui-monospace, 'SF Mono', monospace";
  ctx.letterSpacing = "3px";
  ctx.fillText("DATE ISSUED", dateX, baseY + 40);
  ctx.letterSpacing = "0px";

  /* Seal */
  const sx = 1010, sy = baseY - 8, R = 74;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(sx, sy, R - 26, 0, Math.PI * 2); ctx.stroke();

  const ring = "TRAIN YOUR EYE \u00B7 POLO SENSORY TRAINING \u00B7 ";
  ctx.fillStyle = INK;
  ctx.font = "700 13px ui-monospace, 'SF Mono', monospace";
  ctx.textBaseline = "middle";
  const rr = R - 13;
  for (let i = 0; i < ring.length; i++) {
    const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ring[i], 0, 0);
    ctx.restore();
  }
  ctx.textBaseline = "alphabetic";
  poloMark(ctx, sx, sy - 6, 13, 2.5);
  ctx.fillStyle = MUT;
  ctx.font = "700 9px ui-monospace, 'SF Mono', monospace";
  ctx.letterSpacing = "1.5px";
  ctx.fillText("VERIFIED", sx, sy + 30);
  ctx.letterSpacing = "0px";
}

/* ------------------------------------------------------------------ */
/* MasteryOverlay — celebration + certificate download/copy             */
/* ------------------------------------------------------------------ */

const MasteryOverlay: React.FC<{
  gameName: string;
  level: number;
  points: number;
  bestStreak: number;
  onClose: () => void;
}> = ({ gameName, level, points, bestStreak, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const player = getPlayer();

  useEffect(() => {
    if (canvasRef.current) {
      drawCertificate(canvasRef.current, gameName, player.name ?? "Anonymous", level, points, bestStreak);
    }
  }, [gameName, level, points, bestStreak, player.name]);

  const downloadCert = () => {
    if (!canvasRef.current) return;
    playTick();
    triggerHaptic();
    const link = document.createElement("a");
    link.download = `polo-${gameName.toLowerCase().replace(/\s+/g, "-")}-mastered.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const copyCert = async () => {
    if (!canvasRef.current) return;
    playTick();
    triggerHaptic();
    try {
      const blob = await new Promise<Blob>((res) =>
        canvasRef.current!.toBlob((b) => res(b!), "image/png")
      );
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      downloadCert();
    }
  };

  return (
    <Overlay id="mastery-modal" key="mastery">
      <motion.span
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
        className="text-5xl"
        role="img"
        aria-label="trophy"
      >
        {String.fromCodePoint(0x1F3C6)}
      </motion.span>
      <div>
        <div className="font-display font-extrabold text-xl text-ink mb-1.5">Mastered!</div>
        <p className="text-[14px] text-mut leading-relaxed">
          You completed every level of <b className="text-ink">{gameName}</b>.
        </p>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full max-w-[420px] rounded-xl border-[1.5px] border-line"
        style={{ aspectRatio: "1400/900" }}
      />
      <div className="flex flex-wrap gap-3 justify-center">
        <Btn id="cert-download-btn" variant="secondary" onClick={downloadCert}>
          Download
        </Btn>
        <Btn id="cert-copy-btn" variant="secondary" onClick={copyCert}>
          {copied ? "Copied!" : "Copy image"}
        </Btn>
        <Btn id="mastery-continue-btn" variant="secondary" onClick={onClose}>
          Keep playing
        </Btn>
      </div>
    </Overlay>
  );
};

const GAME_NAMES: Record<GameId, string> = {
  swatch: "Color Match", mix: "Color Mixer", echo: "Repeat the Pattern",
  between: "Find the Spot", shift: "Spot the Difference", tally: "Count it All",
  form: "Shape Match", tilt: "Match the Tilt", chain: "Repeat the Chain",
  round: "Round the Corner", shapeshift: "Spot the Shift", shapetally: "Count the Shapes",
};

export function useProgression(gameId: GameId): Progression {
  const [progress, setProgress] = useState<GameProgress>(() => getProgress(gameId));
  const [toast, setToast] = useState<Toast | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  /* Fatal-miss rescue: pre-break snapshot + the run's points, offered
     right when the streak breaks with no lives left */
  const [rescue, setRescue] = useState<{
    snapshot: { streakCurrent: number; runsInLevel: number; cleanPassesInLevel: number };
    runPoints: number;
  } | null>(null);

  const refresh = useCallback(() => setProgress(getProgress(gameId)), [gameId]);

  /* Push the banked record whenever the game screen closes */
  useEffect(() => {
    return () => {
      const p = getProgress(gameId);
      submitStats(gameId, p.pointsTotal, p.streakBest);
    };
  }, [gameId]);

  const report = useCallback(
    (passed: boolean, points: number): RunOutcome => {
      const before = getProgress(gameId);
      const outcome = reportRun(gameId, passed, points);
      refresh();
      if (outcome.mastered) {
        setToast({ level: outcome.newLevel, mastered: true, gameName: GAME_NAMES[gameId] });
      } else if (outcome.leveledUp) {
        setToast({ level: outcome.newLevel });
        submitStats(gameId, getProgress(gameId).pointsTotal, getProgress(gameId).streakBest);
      }
      /* A run that breaks the streak gets the rescue offer INSTEAD of the
         buy-a-life offer. Showing both stacked one dialog behind the other,
         so buying the streak back was immediately followed by a second,
         near-identical prompt. */
      const offersRescue =
        outcome.kind === "streakBroken" &&
        before.streakCurrent > 0 &&
        before.pointsTotal >= lifeCost(before.level);
      if (outcome.promptBuyLife && !offersRescue) setBuyOpen(true);
      if (outcome.kind === "streakBroken" && before.streakCurrent > 0) {
        /* Streak just died at 0 lives — offer to buy it back on the spot */
        if (before.pointsTotal >= lifeCost(before.level)) {
          setRescue({
            snapshot: {
              streakCurrent: before.streakCurrent,
              runsInLevel: before.runsInLevel,
              cleanPassesInLevel: before.cleanPassesInLevel,
            },
            runPoints: points,
          });
        }
      }
      return outcome;
    },
    [gameId, refresh]
  );

  const handleRescue = () => {
    if (!rescue) return;
    playTick();
    triggerHaptic();
    rescueStreak(gameId, rescue.snapshot, rescue.runPoints);
    refresh();
    setRescue(null);
  };

  const handleBuy = () => {
    playTick();
    triggerHaptic();
    if (buyLife(gameId)) refresh();
    setBuyOpen(false);
  };

  const handleReset = () => {
    playTick();
    triggerHaptic();
    resetLiveState(gameId);
    refresh();
    setResetOpen(false);
  };

  const cost = lifeCost(progress.level);

  const overlays = (
    <AnimatePresence>
      {toast && !toast.mastered && (
        <Overlay id="levelup-toast" key="toast">
          <motion.span
            initial={{ scale: 0.4, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 14 }}
            className="text-5xl"
            role="img"
            aria-label="party popper"
          >
            {"\uD83C\uDF89"}
          </motion.span>
          <span className="w-16 h-16 rounded-2xl bg-ink text-paper font-mono font-extrabold text-xl flex items-center justify-center">
            L{toast.level}
          </span>
          <div>
            <div className="font-display font-extrabold text-xl text-ink mb-1.5">Congrats!</div>
            <p className="text-[14px] text-mut leading-relaxed">
              You're now at Level {toast.level}. +1 life banked{progress.lives >= MAX_LIVES ? " (already full)" : ""}.
            </p>
          </div>
          <Btn id="levelup-continue-btn" variant="secondary" onClick={() => setToast(null)}>
            Keep going
          </Btn>
        </Overlay>
      )}

      {toast?.mastered && (
        <MasteryOverlay
          gameName={toast.gameName ?? ""}
          level={toast.level}
          points={progress.pointsTotal}
          bestStreak={progress.streakBest}
          onClose={() => setToast(null)}
        />
      )}

      {buyOpen && !toast && (
        <Overlay id="buy-life-modal" key="buy">
          {/* Two genuinely different situations, so two different messages.
              One life left is a warning; none left means the next miss ends
              the streak outright. */}
          <motion.span
            initial={{ scale: 0.4, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 14 }}
            className="text-5xl"
            role="img"
            aria-label={progress.lives === 0 ? "empty battery" : "warning"}
          >
            {progress.lives === 0 ? "\uD83E\uDEAB" : "\u26A0\uFE0F"}
          </motion.span>
          <LivesBar lives={progress.lives} />
          <div>
            <div className="font-display font-extrabold text-xl text-ink mb-1.5">
              {progress.lives === 0 ? "No lives in reserve" : "One life left"}
            </div>
            <p className="text-[14px] text-mut leading-relaxed">
              {progress.lives === 0 ? (
                <>
                  The next miss ends your streak
                  {progress.streakCurrent > 0 ? (
                    <> of <b className="text-ink tabular-nums">{progress.streakCurrent}</b></>
                  ) : null}
                  . Buy a reserve life for <b className="text-ink">{cost} points</b>? You have{" "}
                  <b className="text-ink tabular-nums">{progress.pointsTotal}</b>.
                </>
              ) : (
                <>
                  Your last reserve is in play. Stock up now for{" "}
                  <b className="text-ink">{cost} points</b> and a miss spends the spare instead of your
                  streak. You have <b className="text-ink tabular-nums">{progress.pointsTotal}</b> points.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Btn id="buy-life-decline-btn" variant="secondary" onClick={() => setBuyOpen(false)}>
              {progress.lives === 0 ? "Risk it" : "Not now"}
            </Btn>
            <Btn id="buy-life-confirm-btn" onClick={handleBuy} disabled={progress.pointsTotal < cost || progress.lives >= MAX_LIVES}>
              Buy a reserve
            </Btn>
          </div>
        </Overlay>
      )}

      {rescue && !toast && (
        <Overlay id="rescue-modal" key="rescue">
          <motion.span
            initial={{ scale: 0.4, rotate: 8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 14 }}
            className="text-5xl"
            role="img"
            aria-label="breaking heart"
          >
            {"\uD83D\uDC94"}
          </motion.span>
          <LivesBar lives={0} />
          <div>
            <div className="font-display font-extrabold text-xl text-ink mb-1.5">
              Your streak of {rescue.snapshot.streakCurrent} just broke
            </div>
            <p className="text-[14px] text-mut leading-relaxed">
              You had no lives in reserve to absorb that miss. Spend{" "}
              <b className="text-ink">{cost} points</b> to undo the break and carry the streak on? You
              have <b className="text-ink tabular-nums">{progress.pointsTotal}</b>. This is the only
              offer — take it or the streak is gone.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Btn id="rescue-decline-btn" variant="secondary" onClick={() => setRescue(null)}>
              Let it break
            </Btn>
            <Btn id="rescue-confirm-btn" onClick={handleRescue} disabled={progress.pointsTotal < cost}>
              Save my streak
            </Btn>
          </div>
        </Overlay>
      )}

      {resetOpen && (
        <Overlay id="reset-modal" key="reset">
          <div>
            <div className="font-display font-extrabold text-xl text-ink mb-1.5">Start from scratch?</div>
            <p className="text-[14px] text-mut leading-relaxed">
              Your level, lives and current streak reset to the beginning. Your banked points and best
              streak stay on the leaderboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Btn id="reset-cancel-btn" variant="secondary" onClick={() => setResetOpen(false)}>
              Keep playing
            </Btn>
            <Btn id="reset-confirm-btn" onClick={handleReset}>Reset this game</Btn>
          </div>
        </Overlay>
      )}
    </AnimatePresence>
  );

  const maxLevel = MAX_LEVEL[gameId];

  return {
    level: progress.level,
    lives: progress.lives,
    streak: progress.streakCurrent,
    points: progress.pointsTotal,
    maxLevel,
    ramp: difficultyRamp(progress, gameId),
    timerSeconds: countdownFor(gameId, progress.level),
    report,
    requestReset: () => setResetOpen(true),
    overlays,
  };
}

/* ------------------------------------------------------------------ */
/* OutcomeNote — one line under the verdict when a run cost something   */
/* ------------------------------------------------------------------ */

export const OutcomeNote: React.FC<{ outcome: RunOutcome | null }> = ({ outcome }) => {
  if (!outcome || outcome.kind === "pass") return null;
  return (
    <span
      id="run-outcome-note"
      className={`font-mono font-extrabold text-[10.5px] tracking-[0.12em] uppercase rounded-full px-3 py-1 ${
        outcome.kind === "lifeSaved" ? "bg-play-yellow text-ink-fixed" : "bg-play-red text-white"
      }`}
    >
      {outcome.kind === "lifeSaved"
        ? `Life spent — streak safe · ${outcome.livesLeft} left`
        : "Streak broken — level restarts"}
    </span>
  );
};
