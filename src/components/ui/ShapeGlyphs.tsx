/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShapeSpec } from "../../types";

/*
 * Shapes mode drawing kit — the canonical 8-shape vocabulary rendered as
 * SVG, plus the six greyscale tile glyphs. Everything here uses only the
 * ink / mut / line values already present in the chrome; no accent colors.
 */

const INK = "var(--color-ink)";
const MUT = "var(--color-mut)";
const LINE = "var(--color-line)";

/* ------------------------------------------------------------------ */
/* ShapeSvg — one shape, centered in a 100×100 viewBox                  */
/* ------------------------------------------------------------------ */

/* Geometry for each kind in a w×h box centered on the origin */
const shapeElement = (spec: ShapeSpec, paint: { fill: string; stroke: string; strokeWidth: number }) => {
  const scale = spec.scale ?? 1;
  const aspect = spec.aspect ?? 1;
  const s = 78 * scale;
  /* Area-preserving stretch so a squashed shape doesn't just look smaller */
  const w = s * Math.sqrt(aspect);
  const h = s / Math.sqrt(aspect);

  switch (spec.kind) {
    case "square": {
      const rx = ((spec.radius ?? 0) / 100) * Math.min(w, h);
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx} {...paint} />;
    }
    case "circle":
      return <ellipse cx={0} cy={0} rx={w / 2} ry={h / 2} {...paint} />;
    case "triangle":
      return <polygon points={`0,${-h / 2} ${w / 2},${h / 2} ${-w / 2},${h / 2}`} {...paint} />;
    case "hexagon": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${(Math.cos(a) * w) / 2},${(Math.sin(a) * h) / 2}`;
      }).join(" ");
      return <polygon points={pts} {...paint} />;
    }
    case "halfCircle":
      /* Flat-bottomed half disc, vertically centered on its own bulk */
      return <path d={`M ${-w / 2} ${h / 4} A ${w / 2} ${h * 0.75} 0 0 1 ${w / 2} ${h / 4} Z`} {...paint} />;
    case "plus":
    case "cross": {
      /* The cross is the plus rotated 45° — same body */
      const t = w * 0.32; // bar thickness
      const d = [
        `M ${-t / 2} ${-h / 2} h ${t} v ${(h - t) / 2} h ${(w - t) / 2} v ${t}`,
        `h ${-(w - t) / 2} v ${(h - t) / 2} h ${-t} v ${-(h - t) / 2}`,
        `h ${-(w - t) / 2} v ${-t} h ${(w - t) / 2} Z`,
      ].join(" ");
      return <path d={d} {...paint} />;
    }
    case "arrow":
      return (
        <polygon
          points={`${-w / 2},${-h / 6} 0,${-h / 6} 0,${-h / 2} ${w / 2},0 0,${h / 2} 0,${h / 6} ${-w / 2},${h / 6}`}
          {...paint}
        />
      );
  }
};

export const ShapeSvg: React.FC<{ spec: ShapeSpec; color?: string; className?: string }> = ({
  spec,
  color = INK,
  className = "w-full h-full block",
}) => {
  const filled = spec.filled ?? true;
  const paint = filled
    ? { fill: color, stroke: "none", strokeWidth: 0 }
    : { fill: "none", stroke: color, strokeWidth: spec.strokeW ?? 7 };
  const rotation = (spec.rotation ?? 0) + (spec.kind === "cross" ? 45 : 0);

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g transform={`translate(50 50) rotate(${rotation})`} strokeLinejoin="round">
        {shapeElement(spec, paint)}
      </g>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Tile glyphs — mini diagrams of each instrument, greyscale only       */
/* ------------------------------------------------------------------ */

/* Shape Match: 2×2 silhouettes, one odd */
export const FormGlyph: React.FC = () => (
  <span className="grid grid-cols-2 gap-[5px]" aria-hidden="true">
    {(["square", "square", "circle", "square"] as const).map((k, i) => (
      <span key={i} className="w-[21px] h-[21px]">
        <ShapeSvg spec={{ kind: k }} color={k === "circle" ? MUT : INK} />
      </span>
    ))}
  </span>
);

/* Match the Tilt: a leaning line against a level ghost */
export const TiltGlyph: React.FC = () => (
  <span className="relative block w-[58px] h-[40px]" aria-hidden="true">
    <svg viewBox="0 0 58 40" className="w-full h-full block">
      <line x1="7" y1="20" x2="51" y2="20" stroke={LINE} strokeWidth="5" strokeLinecap="round" />
      <line x1="9" y1="31" x2="49" y2="9" stroke={INK} strokeWidth="5" strokeLinecap="round" />
    </svg>
  </span>
);

/* Repeat the Chain: three shapes marching in a row */
export const ChainGlyph: React.FC = () => (
  <span className="flex items-center gap-[5px]" aria-hidden="true">
    <span className="w-[19px] h-[19px]"><ShapeSvg spec={{ kind: "square" }} /></span>
    <span className="w-[19px] h-[19px]"><ShapeSvg spec={{ kind: "triangle" }} color={MUT} /></span>
    <span className="w-[19px] h-[19px]"><ShapeSvg spec={{ kind: "circle" }} /></span>
  </span>
);

/* Round the Corner: the same square at two curvatures */
export const SquircleGlyph: React.FC = () => (
  <span className="flex items-center gap-[7px]" aria-hidden="true">
    <i className="w-[26px] h-[26px] bg-ink" style={{ borderRadius: "12%" }} />
    <i className="w-[26px] h-[26px] bg-mut" style={{ borderRadius: "38%" }} />
  </span>
);

/* Spot the Shift: 3×3 squares, the center one tilted */
export const ShapeShiftGlyph: React.FC = () => (
  <span className="grid grid-cols-3 gap-[4px]" aria-hidden="true">
    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <i
        key={i}
        className="w-[13px] h-[13px] bg-ink rounded-[3px]"
        style={i === 4 ? { transform: "rotate(24deg)", background: MUT } : undefined}
      />
    ))}
  </span>
);

/* Count the Shapes: an ink scatter, no color to lean on */
export const ShapeTallyGlyph: React.FC = () => (
  <span className="relative block w-[58px] h-[44px]" aria-hidden="true">
    <i className="absolute rounded-full bg-ink" style={{ width: 14, height: 14, top: 2, left: 5 }} />
    <i className="absolute rounded-[3px] bg-mut" style={{ width: 11, height: 11, top: 24, left: 22 }} />
    <i className="absolute rounded-full bg-ink" style={{ width: 12, height: 12, top: 5, right: 7 }} />
    <i className="absolute rounded-[3px] bg-ink" style={{ width: 10, height: 10, bottom: 1, left: 2 }} />
    <i className="absolute rounded-full bg-mut" style={{ width: 9, height: 9, bottom: 6, right: 13 }} />
  </span>
);
