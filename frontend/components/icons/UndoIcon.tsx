
import React from 'react';

// Simple left arrow for undo
const UndoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    {/* Left arrow */}
    <line x1="20" y1="12" x2="6" y2="12" />
    <polyline points="10 8 6 12 10 16" />
  </svg>
);

export default UndoIcon;
