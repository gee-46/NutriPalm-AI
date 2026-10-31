import React from "react";

/**
 * A thin botanical sprig: one fine stem, a few paired leaves. Purely decorative (hidden from assistive technology),
 * drawn with `currentColor` so the surrounding ornament colour decides how quiet it is. It never moves.
 */
export const BotanicalSprig: React.FC<{ className?: string; flip?: boolean }> = ({ className = "", flip = false }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 80 200"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`botanical-sprig ${className}`}
    style={flip ? { transform: "scaleX(-1)" } : undefined}
  >
    <path d="M40 196 C41 150 37 100 41 6" />
    <path d="M40.5 168 C28 164 20 156 16 144 C28 146 37 154 40.5 168 Z" />
    <path d="M40.5 150 C53 146 61 138 65 126 C53 128 44 136 40.5 150 Z" />
    <path d="M40 128 C28 124 20 116 17 104 C29 106 37 114 40 128 Z" />
    <path d="M40 108 C52 104 60 96 63 84 C51 86 43 94 40 108 Z" />
    <path d="M40.5 86 C30 82 23 75 21 64 C31 66 38 73 40.5 86 Z" />
    <path d="M41 64 C51 60 57 53 59 43 C50 45 43 52 41 64 Z" />
    <path d="M41 40 C34 36 30 30 29 22 C36 24 40 30 41 40 Z" />
  </svg>
);
