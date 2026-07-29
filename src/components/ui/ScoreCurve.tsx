/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";

/*
 * Where do I actually stand? — a normal curve fitted to the field's points,
 * with the player's own total pinned on it.
 *
 * The curve is a gaussian fitted to the sample (mean and standard
 * deviation), not a histogram: the point is to read your position at a
 * glance, and a smooth curve does that without the visual noise of bins.
 * Points only — streaks are a separate ranking and would need their own
 * curve, which would say the same thing twice.
 */

interface Props {
  /* Every player's banked points for this instrument */
  population: number[];
  /* The reader's own total, pinned on the curve */
  you: number;
  /* Color-mode instruments tint the marker with their own accent */
  accent?: string;
  id?: string;
}

const W = 560;
const H = 150;
const PAD_X = 14;
const BASE_Y = H - 26;

export const ScoreCurve: React.FC<Props> = ({ population, you, accent, id }) => {
  const model = useMemo(() => {
    const all = [...population, you].filter((n) => Number.isFinite(n));
    if (all.length < 2) return null;

    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    const variance = all.reduce((a, b) => a + (b - mean) ** 2, 0) / all.length;
    /* A degenerate field (everyone identical) has no curve to draw */
    const sd = Math.sqrt(variance);
    if (sd < 1) return null;

    /* Domain: ±3sd covers the field, widened if the reader sits outside it */
    const lo = Math.max(0, Math.min(mean - 3 * sd, you - sd * 0.5));
    const hi = Math.max(mean + 3 * sd, you + sd * 0.5);
    const span = hi - lo || 1;

    const xFor = (v: number) => PAD_X + ((v - lo) / span) * (W - PAD_X * 2);
    const pdf = (v: number) => Math.exp(-((v - mean) ** 2) / (2 * sd * sd));

    const steps = 96;
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const v = lo + (span * i) / steps;
      const x = xFor(v);
      const y = BASE_Y - pdf(v) * (BASE_Y - 16);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    const below = population.filter((p) => p < you).length;
    const percentile = population.length ? Math.round((below / population.length) * 100) : 0;

    return {
      line: `M${pts.join(" L")}`,
      area: `M${PAD_X},${BASE_Y} L${pts.join(" L")} L${W - PAD_X},${BASE_Y} Z`,
      youX: xFor(you),
      youY: BASE_Y - pdf(you) * (BASE_Y - 16),
      percentile,
      mean,
      lo,
      hi,
    };
  }, [population, you]);

  if (!model) {
    return (
      <p className="text-[13px] text-mut py-3">
        Not enough scores yet to plot a curve.
      </p>
    );
  }

  const mark = accent || "var(--color-ink)";

  return (
    <div id={id} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img"
        aria-label={`Your points place you in the ${model.percentile}th percentile of players`}>
        {/* Field */}
        <path d={model.area} fill="var(--color-line)" opacity="0.55" />
        <path d={model.line} fill="none" stroke="var(--color-mut)" strokeWidth="2" strokeLinejoin="round" />
        <line x1={PAD_X} y1={BASE_Y} x2={W - PAD_X} y2={BASE_Y} stroke="var(--color-line)" strokeWidth="2" />

        {/* You */}
        <line
          x1={model.youX}
          y1={model.youY - 4}
          x2={model.youX}
          y2={BASE_Y}
          stroke={mark}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={model.youX} cy={model.youY - 4} r="5" fill={mark} />

        {/* Scale: the field's floor, its middle, its ceiling */}
        {[
          { v: model.lo, x: PAD_X, anchor: "start" as const },
          { v: model.mean, x: PAD_X + (W - PAD_X * 2) * ((model.mean - model.lo) / (model.hi - model.lo)), anchor: "middle" as const },
          { v: model.hi, x: W - PAD_X, anchor: "end" as const },
        ].map((t, i) => (
          <text
            key={i}
            x={t.x}
            y={H - 8}
            textAnchor={t.anchor}
            className="font-mono"
            fontSize="11"
            fontWeight="700"
            fill="var(--color-mut)"
          >
            {Math.round(t.v).toLocaleString()}
          </text>
        ))}
      </svg>

      <p className="mt-1 font-mono font-extrabold text-[11px] tracking-[0.12em] uppercase text-mut tabular-nums">
        You · {you.toLocaleString()} pts ·{" "}
        <span className="text-ink">{model.percentile}th percentile</span>
      </p>
    </div>
  );
};

export default ScoreCurve;
