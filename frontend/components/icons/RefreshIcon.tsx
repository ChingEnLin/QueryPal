import React from 'react';

// Modern, bold refresh icon with a dynamic arrow and partial circle
const RefreshIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Partial bold circle */}
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    {/* Arrow head */}
    <polyline points="22 4 22 8 18 8" />
    {/* Subtle shadow for depth */}
    <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeOpacity="0.15" strokeWidth={3} />
  </svg>
);

export default RefreshIcon;
