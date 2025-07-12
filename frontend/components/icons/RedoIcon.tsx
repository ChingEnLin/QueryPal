
import React from 'react';

// Simple right arrow for redo
const RedoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Right arrow */}
    <line x1="4" y1="12" x2="18" y2="12" />
    <polyline points="14 8 18 12 14 16" />
  </svg>
);

export default RedoIcon;
