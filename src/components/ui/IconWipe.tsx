/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { ShapeGameId } from "../../types";
import {
  FormGlyph,
  TiltGlyph,
  ChainGlyph,
  SquircleGlyph,
  ShapeShiftGlyph,
  ShapeTallyGlyph,
} from "./ShapeGlyphs";

/*
 * Shapes-mode tile→game wipe: the instrument's own tile icon, scaled up,
 * fading in quickly with one small settle — a quick rotate and a spring
 * scale-up from a touch under full size. No masks, no separate motif;
 * the icon that sold the tile is the same icon that greets the game.
 */

const ICONS: Record<ShapeGameId, React.ReactNode> = {
  form: <FormGlyph />,
  tilt: <TiltGlyph />,
  chain: <ChainGlyph />,
  round: <SquircleGlyph />,
  shapeshift: <ShapeShiftGlyph />,
  shapetally: <ShapeTallyGlyph />,
};

export const IconWipe: React.FC<{ pattern: ShapeGameId }> = ({ pattern }) => (
  <span className="polo-wipe" aria-hidden="true">
    {/* Static 3.6× blow-up of the tile icon; the inner motion.span owns
        the fade/settle animation so its own animated transform doesn't
        clobber this fixed scale. */}
    <span className="block" style={{ transform: "scale(3.6)" }}>
      <motion.span
        className="block"
        initial={{ opacity: 0, scale: 0.75, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 20 }}
      >
        {ICONS[pattern]}
      </motion.span>
    </span>
  </span>
);

export default IconWipe;
