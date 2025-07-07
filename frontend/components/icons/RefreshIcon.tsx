import React from 'react';

const RefreshIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 4H3" />
    <path d="M11 20v-6a4 4 0 0 1 4-4v0a4 4 0 0 1 4 4v6" />
    <path d="M3 20v-6a4 4 0 0 1 4-4h1" />
    <path d="M21 12a9 9 0 0 0-9-9H3" />
    <path d="M3 12a9 9 0 0 0 9 9h9" />
  </svg>
);

export default RefreshIcon;
