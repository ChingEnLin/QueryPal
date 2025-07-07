import React from 'react';

const QueryPalIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    {...props}
  >
    <defs>
      <linearGradient id="gradientStroke" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#00d4ff" />
        <stop offset="100%" stopColor="#0066ff" />
      </linearGradient>
    </defs>

    {/* Leaf Chat Outline */}
    <path
      d="
        M32 4
        C20 6, 10 18, 14 34
        C16 42, 24 50, 30 52
        L28 60
        L38 54
        C50 50, 56 38, 52 26
        C48 14, 42 6, 32 4
        Z
      "
      stroke="url(#gradientStroke)"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Main Vein */}
    <path
      d="M32 10 C30 24, 34 40, 28 52"
      stroke="url(#gradientStroke)"
      strokeWidth="1.5"
      fill="none"
    />

    {/* Branch Veins (Left) */}
    <path d="M30 20 L24 18" stroke="url(#gradientStroke)" strokeWidth="1" />
    <path d="M30 26 L22 25" stroke="url(#gradientStroke)" strokeWidth="1" />
    <path d="M30 32 L22 32" stroke="url(#gradientStroke)" strokeWidth="1" />
    
    {/* Branch Veins (Right) */}
    <path d="M32 20 L38 18" stroke="url(#gradientStroke)" strokeWidth="1" />
    <path d="M32 26 L42 24" stroke="url(#gradientStroke)" strokeWidth="1" />
    <path d="M32 32 L42 30" stroke="url(#gradientStroke)" strokeWidth="1" />
  </svg>
);

export default QueryPalIcon;