/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MixRoundData } from "../../types";
import { setupMixRound } from "../../utils/gameLogic";
import { hslToCss, getScoreForColors, mixHslAverage, HSL } from "../../utils/color";
import { GameHead, Ready, Countdown, VerdictHead, VerdictBody, Btn, PassNote } from "../ui/Kit";
import { MixGlyph } from "../ui/Glyphs";
import { useProgression, LivesBar, RunTimer, OutcomeNote } from "../ui/Progress";
import { RunOutcome } from "../../utils/progression";
import { playTick, playRevealInterval, triggerHaptic } from "../../utils/audio";

interface GameProps {
  accentColor: string;
  onBack: () => void;
  onResult?: (correct: boolean) => void;
  streak?: number;
}

/* The dark-mode CTA reads red rather than the tile's own blue — blue read
   poorly against the dark wash fill, red carries more contrast here. */
const CTA_ACCENT = "#ff4b3e";

/*
 * Color Mixer — the level unlocks dials rather than shrinking tolerances:
 *  L1 hue only · L2 +saturation · L3 +lightness · L4 +opacity over a
 *  checkerboard · L5 two half-opacity circles (hue dial per circle, the
 *  target is their intersection) · L6 a third circle joins the blend.
 * Every level runs against the same fixed 120-second clock.
 */

/* ------------------------------------------------------------------ */
/* Venn preview — circles at half opacity, the CENTER lens painted with
   the exact scored average so eye and math always agree                */
/* ------------------------------------------------------------------ */

const VennPreview: React.FC<{
  hues: number[];
  s: number;
  l: number;
  center: HSL;
  id?: string;
}> = ({ hues, s, l, center, id }) => {
  const three = hues.length >= 3;
  const geom = three
    ? [
        { cx: 38, cy: 40 },
        { cx: 62, cy: 40 },
        { cx: 50, cy: 61 },
      ]
    : [
        { cx: 39, cy: 50 },
        { cx: 61, cy: 50 },
      ];
  const r = three ? 26 : 28;
  const uid = id ?? "venn";
  return (
    <svg id={id} viewBox="0 0 100 100" className="w-44 h-44 sm:w-52 sm:h-52 block" aria-hidden="true">
      <defs>
        {geom.map((g, i) => (
          <clipPath key={i} id={`${uid}-clip-${i}`}>
            <circle cx={g.cx} cy={g.cy} r={r} />
          </clipPath>
        ))}
      </defs>
      {geom.map((g, i) => (
        <circle
          key={i}
          cx={g.cx}
          cy={g.cy}
          r={r}
          fill={hslToCss({ h: hues[i], s, l })}
          opacity={0.55}
        />
      ))}
      {/* The intersection, painted with the true average color */}
      <g clipPath={`url(#${uid}-clip-0)`}>
        <g clipPath={`url(#${uid}-clip-1)`}>
          {three ? (
            <circle cx={geom[2].cx} cy={geom[2].cy} r={r} fill={hslToCss(center)} />
          ) : (
            <circle cx={geom[1].cx} cy={geom[1].cy} r={r} fill={hslToCss(center)} />
          )}
        </g>
      </g>
    </svg>
  );
};

/* Swatch that can carry an alpha channel over the checkerboard */
const AlphaSwatch: React.FC<{
  color: HSL;
  alpha?: number;
  sizeClass: string;
  id?: string;
  fadeIn?: boolean;
}> = ({ color, alpha, sizeClass, id, fadeIn = false }) => (
  <div className={`${sizeClass} rounded-3xl border-[1.5px] border-line overflow-hidden relative ${alpha !== undefined ? "polo-checker" : ""}`}>
    <motion.div
      id={id}
      className="absolute inset-0"
      initial={fadeIn ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: fadeIn ? 0.35 : 0 }}
      style={{
        backgroundColor:
          alpha !== undefined
            ? `hsla(${color.h}, ${color.s}%, ${color.l}%, ${alpha})`
            : hslToCss(color),
      }}
    />
  </div>
);

export const MixGame: React.FC<GameProps> = ({ onBack, onResult, accentColor }) => {
  const prog = useProgression("mix");
  const [stage, setStage] = useState<"getReady" | "countdown" | "stimulus" | "answer" | "reveal">("getReady");
  const [roundData, setRoundData] = useState<MixRoundData>(() => setupMixRound(prog.level));
  const [round, setRound] = useState(1);
  const [lastOutcome, setLastOutcome] = useState<RunOutcome | null>(null);

  const level = prog.level;
  const blendMode = level >= 5;

  /* Next run waits for the CTA — no auto-advance */
  const handleNextRound = () => {
    setRoundData(setupMixRound(prog.level));
    setRound((r) => r + 1);
    setStage("countdown");
  };

  useEffect(() => {
    if (stage === "stimulus") {
      const timer = setTimeout(() => setStage("answer"), 2000);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  useEffect(() => {
    if (stage === "reveal") playRevealInterval();
  }, [stage]);

  /* The color each side actually presents — plain mix, or the lens color */
  const lensOf = (hues: number[]): HSL =>
    mixHslAverage(hues.map((h) => ({ h, s: roundData.targetColor.s, l: roundData.targetColor.l })));
  const targetShown = blendMode && roundData.targetHues ? lensOf(roundData.targetHues) : roundData.targetColor;
  const userShown = blendMode && roundData.userHues ? lensOf(roundData.userHues) : roundData.userColor;

  const computeScore = (): number => {
    let score = getScoreForColors(targetShown, userShown);
    if (level === 4 && roundData.targetAlpha !== undefined && roundData.userAlpha !== undefined) {
      score = Math.round(score * (1 - Math.abs(roundData.targetAlpha - roundData.userAlpha)));
    }
    return score;
  };

  const handleDone = () => {
    if (stage !== "answer") return;
    const finalScore = computeScore();
    onResult?.(finalScore >= 80);
    setLastOutcome(prog.report(finalScore >= 80, finalScore));
    setRoundData((prev) => ({ ...prev, score: finalScore }));
    setStage("reveal");
  };

  /* 120s clock ran dry — the mix locks in exactly as it stands */
  const handleTimeUp = () => {
    if (stage !== "answer") return;
    triggerHaptic();
    handleDone();
  };

  const handleSliderChange = (key: "h" | "s" | "l", value: number) => {
    if (stage !== "answer") return;
    setRoundData((prev) => ({ ...prev, userColor: { ...prev.userColor, [key]: value } }));
  };
  const handleAlphaChange = (value: number) => {
    if (stage !== "answer") return;
    setRoundData((prev) => ({ ...prev, userAlpha: value / 100 }));
  };
  const handleBlendHue = (idx: number, value: number) => {
    if (stage !== "answer") return;
    setRoundData((prev) => ({
      ...prev,
      userHues: prev.userHues?.map((h, i) => (i === idx ? value : h)),
      userColor: idx === 0 ? { ...prev.userColor, h: value } : prev.userColor,
    }));
  };

  const hueGradient = "linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)";
  const satGradient = `linear-gradient(to right, hsl(${roundData.userColor.h}, 0%, ${roundData.userColor.l}%), hsl(${roundData.userColor.h}, 100%, ${roundData.userColor.l}%))`;
  const lightGradient = `linear-gradient(to right, black, hsl(${roundData.userColor.h}, ${roundData.userColor.s}%, 50%), white)`;
  const alphaGradient = `linear-gradient(to right, transparent, ${hslToCss(roundData.userColor)})`;

  const score = roundData.score ?? 0;
  const verdictHead =
    score >= 90 ? "Resonance." : score >= 80 ? "Nearly there." : "Different animal.";
  const verdictDetail =
    score >= 90
      ? "Your mix melts into the target."
      : score >= 80
        ? "Squint and they merge. Fine-tune the last dial next time."
        : blendMode
          ? "Watch the lens where the circles cross — that's the color being judged."
          : "Compare the pair above — usually it's saturation that drifts first.";

  const slider = (
    id: string,
    label: string,
    value: number,
    max: number,
    unit: string,
    gradient: string,
    onChange: (v: number) => void
  ) => (
    <div className="flex flex-col">
      <div className="flex justify-between font-mono font-extrabold text-[11px] tracking-[0.12em] uppercase text-ink mb-2.5 tabular-nums">
        <span>{label}</span>
        <span>{value}{unit}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="polo-range w-full"
        style={{ background: gradient }}
        aria-label={label}
      />
    </div>
  );

  const readySteps =
    level >= 6
      ? [
          "Three half-transparent circles overlap — memorize the color at their center.",
          "Tune each circle's hue dial; saturation and lightness are locked.",
          "Land it before the 2-minute clock runs out.",
        ]
      : level >= 5
        ? [
            "Two half-transparent circles overlap — memorize the color where they cross.",
            "Tune each circle's hue dial; saturation and lightness are locked.",
            "Land it before the 2-minute clock runs out.",
          ]
        : [
            "Study and memorize the target color — you get two seconds.",
            level >= 4
              ? "Rebuild it with hue, saturation, lightness AND opacity — the checkerboard shows through."
              : level >= 3
                ? "Rebuild it from memory with the hue, saturation and lightness dials."
                : level >= 2
                  ? "Rebuild it from memory with the hue and saturation dials."
                  : "Rebuild it from memory with the hue dial.",
            "Lock it in before the 2-minute clock runs out.",
          ];

  return (
    <div id="mix-game-container" className="w-full flex flex-col flex-1 max-w-3xl mx-auto">
      <GameHead
        title="Color Mixer"
        onBack={onBack}
        streak={prog.streak}
        points={prog.points}
        level={prog.level}
        lives={<LivesBar lives={prog.lives} />}
        onReset={prog.requestReset}
        gameId="mix"
        accent={accentColor}
      />

      <div className="flex-1 flex flex-col justify-center pb-6">
        {stage === "getReady" && (
          <Ready
            name="Color Mixer"
            steps={readySteps}
            glyph={<span className="scale-150 inline-block"><MixGlyph /></span>}
            onComplete={() => setStage("stimulus")}
            note={<PassNote tone="color" />}
            accentColor={CTA_ACCENT}
          />
        )}

        {stage === "countdown" && <Countdown onComplete={() => setStage("stimulus")} />}

        {stage === "stimulus" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
            className="flex flex-col items-center gap-6"
          >
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-mut">
              {blendMode ? "Memorize the intersection color" : "Memorize this color"}
            </span>
            {blendMode && roundData.targetHues ? (
              <VennPreview
                id="mix-stimulus-venn"
                hues={roundData.targetHues}
                s={roundData.targetColor.s}
                l={roundData.targetColor.l}
                center={targetShown}
              />
            ) : (
              <AlphaSwatch
                id="mix-stimulus-box"
                color={roundData.targetColor}
                alpha={level >= 4 ? roundData.targetAlpha : undefined}
                sizeClass="w-52 h-52 sm:w-60 sm:h-60"
                fadeIn={level >= 4}
              />
            )}
          </motion.div>
        )}

        {stage === "answer" && (
          <div className="flex flex-col items-center w-full gap-7">
            <span className="font-mono font-extrabold text-[12px] tracking-[0.18em] uppercase text-ink">
              Rebuild it from memory
            </span>
            {prog.timerSeconds !== null && (
              <RunTimer
                id="mix-run-timer"
                seconds={prog.timerSeconds}
                running={stage === "answer"}
                runKey={round}
                onExpire={handleTimeUp}
              />
            )}

            {/* Mixer visual and dials sit SIDE BY SIDE from sm: up so the
                CTA stays above the fold even at L6 (3 circles + 3 sliders) */}
            <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-center gap-7 sm:gap-10">
            {blendMode && roundData.userHues ? (
              <div className="flex flex-col items-center gap-2 shrink-0">
                <VennPreview
                  id="mix-interactive-venn"
                  hues={roundData.userHues}
                  s={roundData.targetColor.s}
                  l={roundData.targetColor.l}
                  center={userShown}
                />
                <span className="font-mono font-medium text-[10.5px] tracking-[0.14em] uppercase text-mut">
                  Your live blend — match the center lens
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-5 shrink-0">
                <AlphaSwatch
                  id="mix-interactive-swatch"
                  color={roundData.userColor}
                  alpha={level >= 4 ? roundData.userAlpha : undefined}
                  sizeClass="w-24 h-24 !rounded-2xl"
                />
                <p className="text-[15px] text-mut max-w-[24ch] leading-relaxed">
                  <b className="text-ink font-semibold">Your live mix.</b><br />
                  Dial it until it matches the color you memorized.
                </p>
              </div>
            )}

            <div className="w-full max-w-sm sm:max-w-none sm:flex-1 flex flex-col gap-6">
              {blendMode && roundData.userHues ? (
                roundData.userHues.map((h, i) =>
                  slider(
                    `mix-slider-blend-${i}`,
                    `Circle ${i + 1} · Hue`,
                    h,
                    360,
                    "°",
                    hueGradient,
                    (v) => handleBlendHue(i, v)
                  )
                )
              ) : (
                <>
                  {slider("mix-slider-hue", "Hue", roundData.userColor.h, 360, "°", hueGradient, (v) => handleSliderChange("h", v))}
                  {level >= 2 &&
                    slider("mix-slider-saturation", "Saturation", roundData.userColor.s, 100, "%", satGradient, (v) => handleSliderChange("s", v))}
                  {level >= 3 &&
                    slider("mix-slider-lightness", "Lightness", roundData.userColor.l, 100, "%", lightGradient, (v) => handleSliderChange("l", v))}
                  {level >= 4 &&
                    slider("mix-slider-opacity", "Opacity", Math.round((roundData.userAlpha ?? 1) * 100), 100, "%", alphaGradient, handleAlphaChange)}
                </>
              )}
            </div>
            </div>

            <Btn id="mix-done-btn" accent={CTA_ACCENT} onClick={handleDone}>Lock it in</Btn>
          </div>
        )}

        {stage === "reveal" && (
          <div className="flex flex-col items-center gap-7">
            <VerdictHead
              id="mix-reveal-verdict"
              ok={score >= 80}
              headline={verdictHead}
              score={String(score)}
              scoreCaption="Match / 100"
            />
            <OutcomeNote outcome={lastOutcome} />

            <div className="flex items-end gap-6">
              <div className="flex flex-col items-center gap-2.5">
                <AlphaSwatch
                  id="mix-reveal-target"
                  color={targetShown}
                  alpha={level === 4 ? roundData.targetAlpha : undefined}
                  sizeClass="w-32 h-32 sm:w-36 sm:h-36"
                />
                <span className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-mut">Target</span>
              </div>
              <div className="flex flex-col items-center gap-2.5">
                <AlphaSwatch
                  id="mix-reveal-user"
                  color={userShown}
                  alpha={level === 4 ? roundData.userAlpha : undefined}
                  sizeClass="w-32 h-32 sm:w-36 sm:h-36"
                />
                <span className="font-mono font-extrabold text-[11px] tracking-[0.14em] uppercase text-mut">Your mix</span>
              </div>
            </div>

            <VerdictBody id="mix-reveal-score" detail={verdictDetail} />

            <Btn id="mix-next-btn" variant="secondary" onClick={handleNextRound}>Next color</Btn>
          </div>
        )}
      </div>
      {prog.overlays}
    </div>
  );
};
