/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HSL } from "./utils/color";

export type ColorGameId = "swatch" | "mix" | "echo" | "between" | "shift" | "tally";

/* Shapes mode — six parallel instruments, purely greyscale */
export type ShapeGameId = "form" | "tilt" | "chain" | "round" | "shapeshift" | "shapetally";

export type GameId = ColorGameId | ShapeGameId;

/* Which tile set the home screen shows. Resets to color on every load. */
export type PlayMode = "color" | "shapes";

/* In-session difficulty for shape games. Pass-gated: a passed round climbs
   one rung, a miss replays the same rung. Most games cap at L6; Shape Match
   spreads its ramp across L8. Resets on re-entry. */
export type ShapeLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type GameStage = "getReady" | "stimulus" | "answer" | "reveal";

export interface GameInfo {
  id: GameId;
  name: string;
  symbol: string; // Bauhaus geometric description
  oneLiner: string;
  accent: string; // hex color for accenting
}

export interface SwatchRoundData {
  targetColor: HSL;
  options: { color: HSL; isCorrect: boolean }[];
  userSelection: HSL | null;
}

export interface MixRoundData {
  targetColor: HSL;
  userColor: HSL;
  score: number | null;
  /* L4: the opacity channel joins the dials */
  targetAlpha?: number;
  userAlpha?: number;
  /* L5/L6: per-circle hues; saturation/lightness lock to targetColor's */
  targetHues?: number[];
  userHues?: number[];
}

export interface EchoRoundData {
  squares: { id: number; color: HSL }[];
  sequence: number[]; // pad indices in order of lighting up (may repeat at high levels)
  userTaps: number[];
  isCorrect: boolean | null;
}

/* Difficulty knobs for Repeat the Pattern, derived from the current streak */
export interface EchoParams {
  boxes: number; // number of pads on the board
  seqLen: number; // taps in the sequence (> boxes once repeats unlock)
  speed: number; // ms between flashes
  allowRepeat: boolean; // whether a pad may appear twice in a sequence
}

export interface BetweenRoundData {
  colorStart: HSL;
  colorEnd: HSL;
  truePosition: number; // 0.0 to 1.0
  guessPosition: number; // 0.0 to 1.0
  score: number | null;
}

export interface ShiftRoundData {
  originalColors: HSL[];
  shiftedIndex: number; // 0 to 3
  shiftedColors: HSL[];
  userSelection: number | null; // 0 to 3
}

export type TallyShape = "circle" | "square" | "triangle";

export type TallyMode = "dots" | "shapes";

export interface TallyRoundData {
  points: { x: number; y: number; r: number; shape?: TallyShape }[]; // x, y are percentages 5-95, r is radius
  trueCount: number; // dots mode: total pieces; shapes mode: count of the target shape
  options: number[];
  userSelection: number | null;
  mode: TallyMode;
  targetShape?: TallyShape; // shapes mode only — the shape being counted
}

/* ------------------------------------------------------------------ */
/* Shapes mode                                                         */
/* ------------------------------------------------------------------ */

/* The canonical shape vocabulary */
export type ShapeKind =
  | "square"
  | "circle"
  | "triangle"
  | "plus"
  | "hexagon"
  | "halfCircle"
  | "cross"
  | "arrow";

/* One drawable shape. Everything beyond `kind` is a variation knob the
   higher Form levels turn: stretch, size, outline weight, fill, rotation. */
export interface ShapeSpec {
  kind: ShapeKind;
  aspect?: number; // width/height stretch, 1 = natural (area-preserving)
  scale?: number; // proportional size, 1 = fills the cell
  strokeW?: number; // outline weight in viewBox units (outline mode only)
  filled?: boolean; // default true
  rotation?: number; // degrees clockwise
  radius?: number; // corner radius for squares, % of side (0-50)
}

export interface FormRoundData {
  target: ShapeSpec;
  options: { spec: ShapeSpec; isCorrect: boolean }[];
  userSelection: number | null; // option index
}

export interface TiltRoundData {
  trueAngle: number; // 0-180, a line's rotation
  guessAngle: number; // 0-180
  score: number | null;
}

export interface ChainRoundData {
  pool: ShapeKind[]; // unique shapes offered in the answer palette
  sequence: ShapeKind[]; // the shape shown at each position, left to right
  userSeq: ShapeKind[];
  isCorrect: boolean | null;
}

/* Difficulty knobs for Repeat the Chain, from the level table */
export interface ChainParams {
  len: number; // positions in the row
  poolSize: number; // distinct shapes in play
  allowRepeat: boolean; // whether a shape may appear twice
  sameFamily: boolean; // L6: pool drawn from one visual family
}

/* Corner order: top-left, top-right, bottom-right, bottom-left —
   matching the CSS border-radius shorthand */
export interface SquircleRoundData {
  trueRadii: [number, number, number, number]; // % of side, 0-40 each
  guessRadii: [number, number, number, number];
  phase: number; // 0 = uniform corners; k = k corners differ from the base
  score: number | null;
}

export type ShapeChangeKind = "rotation" | "size" | "radius" | "swap";

export interface ShapeShiftRoundData {
  baseSpec: ShapeSpec; // uniform rounds: all four start as this
  /* Lineup rounds: four DIFFERENT shapes, one of which gets swapped for a
     fifth kind. When present it overrides baseSpec per cell. */
  cellSpecs?: ShapeSpec[];
  changedIndex: number; // 0 to 3
  changedSpec: ShapeSpec; // what the changed one came back as
  changeKind: ShapeChangeKind;
  userSelection: number | null;
}

export interface ShapeTallyRoundData {
  points: { x: number; y: number; r: number }[];
  piece: "circle" | "square"; // varies by round, all one greyscale value
  trueCount: number;
  options: number[];
  userSelection: number | null;
}
