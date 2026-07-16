/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { PlayMode } from "../../types";

/*
 * The mode rocker — Color / Shapes as a physical two-way rocker switch,
 * in the site's flat press-depth language. Each side is its own keycap:
 * the active side sits pressed (down, shadow swallowed), the idle side
 * sits proud (up, hard under-shadow), and the whole switch leans a degree
 * toward the pressed side, pivoting like a real rocker. Springs carry the
 * click; no gradients, no 3D.
 */

const BrushIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20.7 3.3c-1.2-1.2-3.1-1-4.1.3L9.2 12.9l2.9 2.9 9.3-7.4c1.3-1 1.5-2.9.3-4.1Z"
      fill="currentColor"
    />
    <path
      d="M8 14c-1.7 0-3 1.3-3 3 0 1.3-1 2-2 2 .8 1.2 2.2 2 3.8 2 2.3 0 4.2-1.9 4.2-4.2L8 14Z"
      fill="currentColor"
    />
  </svg>
);

const ShapesIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="12.5" width="8.5" height="8.5" rx="1.5" fill="currentColor" />
    <circle cx="16.75" cy="16.75" r="4.25" fill="currentColor" />
    <path d="M12 2 17.5 10.5 6.5 10.5 12 2Z" fill="currentColor" />
  </svg>
);

interface RockerProps {
  mode: PlayMode;
  onChange: (next: PlayMode) => void;
}

const SIDES: { id: PlayMode; label: string; icon: React.ReactNode }[] = [
  { id: "color", label: "Color", icon: <BrushIcon /> },
  { id: "shapes", label: "Shapes", icon: <ShapesIcon /> },
];

export const RockerSwitch: React.FC<RockerProps> = ({ mode, onChange }) => (
  <motion.div
    id="mode-toggle"
    role="tablist"
    aria-label="Game mode"
    className="inline-flex"
    animate={{ rotate: mode === "color" ? -1.4 : 1.4 }}
    transition={{ type: "spring", stiffness: 380, damping: 14 }}
    style={{ transformOrigin: "50% 100%" }}
  >
    {SIDES.map(({ id, label, icon }, i) => {
      const active = mode === id;
      return (
        <motion.button
          key={id}
          id={`mode-toggle-${id}`}
          role="tab"
          aria-selected={active}
          onClick={() => onChange(id)}
          className={`flex items-center gap-2.5 px-7 sm:px-9 py-4 sm:py-5 font-mono font-extrabold text-[14px] sm:text-[15px] tracking-[0.16em] uppercase cursor-pointer border-[3px] border-ink select-none ${
            i === 0 ? "rounded-l-full" : "rounded-r-full -ml-[3px]"
          } ${active ? "bg-ink text-paper" : "bg-paper text-ink"}`}
          animate={{
            y: active ? 4 : -4,
            boxShadow: active ? "0 0px 0px var(--color-ink)" : "0 7px 0px var(--color-ink)",
          }}
          transition={{ type: "spring", stiffness: 520, damping: 17 }}
        >
          {icon}
          {label}
        </motion.button>
      );
    })}
  </motion.div>
);

export default RockerSwitch;
