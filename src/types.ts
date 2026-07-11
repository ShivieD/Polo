/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HSL } from "./utils/color";

export type GameId = "swatch" | "mix" | "echo" | "between" | "shift" | "tally";

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
}

export interface EchoRoundData {
  squares: { id: number; color: HSL }[];
  sequence: number[]; // indices 0 - 3 in order of lighting up
  userTaps: number[];
  isCorrect: boolean | null;
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

export interface TallyRoundData {
  points: { x: number; y: number; r: number }[]; // x, y are percentages 5-95, r is radius
  trueCount: number;
  options: number[];
  userSelection: number | null;
}
