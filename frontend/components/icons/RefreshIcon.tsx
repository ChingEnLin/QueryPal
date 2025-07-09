import React from 'react';


const RefreshIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Circular arrow */}
    <path d="M4.93 4.93a10 10 0 1 1-1.32 2.09" />
    <polyline points="4 4 4 8 8 8" />
    {/* Small clock in the center */}
    <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <line x1="12" y1="12" x2="12" y2="9.8" stroke="currentColor" strokeWidth="1.2" />
    <line x1="12" y1="12" x2="13.6" y2="12" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

export default RefreshIcon;
