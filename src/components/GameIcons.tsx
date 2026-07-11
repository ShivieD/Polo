/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface IconProps {
  className?: string;
  accentColor?: string;
}

export const SwatchIcon: React.FC<IconProps> = ({ className = "w-12 h-12", accentColor = "currentColor" }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="24" height="24" fill={accentColor} rx="1" />
  </svg>
);

export const MixIcon: React.FC<IconProps> = ({ className = "w-12 h-12", accentColor = "currentColor" }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Concentric squares representing mixing */}
    <rect x="6" y="6" width="28" height="28" stroke={accentColor} strokeWidth="2" rx="1" />
    <rect x="14" y="14" width="12" height="12" fill={accentColor} rx="1" />
  </svg>
);

export const EchoIcon: React.FC<IconProps> = ({ className = "w-12 h-12", accentColor = "currentColor" }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Four small horizontal aligned squares */}
    <rect x="4" y="16" width="6" height="8" fill={accentColor} rx="1" />
    <rect x="13" y="16" width="6" height="8" fill={accentColor} rx="1" />
    <rect x="22" y="16" width="6" height="8" fill={accentColor} rx="1" />
    <rect x="31" y="16" width="6" height="8" fill={accentColor} rx="1" />
  </svg>
);

export const BetweenIcon: React.FC<IconProps> = ({ className = "w-12 h-12", accentColor = "currentColor" }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Horizontal thick bar */}
    <rect x="4" y="17" width="32" height="6" fill={accentColor} rx="1" />
  </svg>
);

export const ShiftIcon: React.FC<IconProps> = ({ className = "w-12 h-12", accentColor = "currentColor" }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Two squares side by side, one shifted/dashed */}
    <rect x="6" y="12" width="12" height="16" stroke={accentColor} strokeWidth="2" rx="1" />
    <rect x="22" y="12" width="12" height="16" stroke={accentColor} strokeWidth="2" strokeDasharray="3 3" rx="1" />
    <rect x="24" y="10" width="12" height="16" fill={accentColor} rx="1" opacity="0.8" />
  </svg>
);

export const TallyIcon: React.FC<IconProps> = ({ className = "w-12 h-12", accentColor = "currentColor" }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Scatter of small filled circles */}
    <circle cx="12" cy="14" r="3" fill={accentColor} />
    <circle cx="28" cy="12" r="3.5" fill={accentColor} />
    <circle cx="14" cy="28" r="4" fill={accentColor} />
    <circle cx="26" cy="26" r="2.5" fill={accentColor} />
    <circle cx="19" cy="20" r="3" fill={accentColor} />
  </svg>
);
