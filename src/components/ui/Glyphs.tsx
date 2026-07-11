/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

/*
 * Block-built game glyphs — each one is a mini diagram of its game's
 * mechanic, drawn from the four playable primaries. Not icon-font icons.
 */

const RED = "var(--color-play-red)";
const YELLOW = "var(--color-play-yellow)";
const BLUE = "var(--color-play-blue)";
const GREEN = "var(--color-play-green)";
const INK = "var(--color-ink)";

/* Color Match: 2×2 swatches, one odd */
export const SwatchGlyph: React.FC = () => (
  <span className="grid grid-cols-2 gap-[5px]" aria-hidden="true">
    {[BLUE, BLUE, RED, BLUE].map((c, i) => (
      <i key={i} className="w-[21px] h-[21px] rounded-md" style={{ background: c }} />
    ))}
  </span>
);

/* Color Mixer: two circles blending */
export const MixGlyph: React.FC = () => (
  <span className="relative block w-[58px] h-[40px]" aria-hidden="true">
    <i className="absolute left-0 top-[1px] w-[38px] h-[38px] rounded-full mix-blend-multiply" style={{ background: RED }} />
    <i className="absolute right-0 top-[1px] w-[38px] h-[38px] rounded-full mix-blend-multiply" style={{ background: BLUE }} />
  </span>
);

/* Repeat the Pattern: 2×2 pads, one lit */
export const EchoGlyph: React.FC = () => (
  <span className="grid grid-cols-2 gap-[5px]" aria-hidden="true">
    {[0, 1, 2, 3].map((i) => (
      <i
        key={i}
        className="w-[21px] h-[21px] rounded-md border-[3px]"
        style={{ borderColor: INK, background: i === 1 ? YELLOW : "transparent" }}
      />
    ))}
  </span>
);

/* Find the Spot: gradient bar with a needle */
export const BetweenGlyph: React.FC = () => (
  <span className="relative block w-[58px] h-[17px] rounded-full" aria-hidden="true"
    style={{ background: `linear-gradient(90deg, ${RED}, ${YELLOW}, ${GREEN})` }}>
    <i className="absolute -top-1.5 -bottom-1.5 left-[62%] w-[5px] rounded-[3px]" style={{ background: INK }} />
  </span>
);

/* Spot the Difference: 3×3 dots, one drifted */
export const ShiftGlyph: React.FC = () => (
  <span className="grid grid-cols-3 gap-[4px]" aria-hidden="true">
    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <i key={i} className="w-[14px] h-[14px] rounded-full" style={{ background: i === 4 ? "#7EDF9E" : GREEN }} />
    ))}
  </span>
);

/* Count the Dots: a scatter of primary dots */
export const TallyGlyph: React.FC = () => (
  <span className="relative block w-[58px] h-[44px]" aria-hidden="true">
    <i className="absolute rounded-full" style={{ width: 15, height: 15, background: RED, top: 2, left: 4 }} />
    <i className="absolute rounded-full" style={{ width: 11, height: 11, background: BLUE, top: 24, left: 22 }} />
    <i className="absolute rounded-full" style={{ width: 13, height: 13, background: YELLOW, top: 6, right: 6 }} />
    <i className="absolute rounded-full" style={{ width: 10, height: 10, background: GREEN, bottom: 0, left: 2 }} />
    <i className="absolute rounded-full" style={{ width: 9, height: 9, background: INK, bottom: 6, right: 14 }} />
  </span>
);

/* The identity mark: four primary squares */
export const PoloMark: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <span className="flex gap-1" aria-hidden="true">
    {[RED, YELLOW, BLUE, GREEN].map((c, i) => (
      <i key={i} className="rounded-[4px]" style={{ width: size, height: size, background: c }} />
    ))}
  </span>
);
