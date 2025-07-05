import React from 'react';

const MicrosoftIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fillRule="evenodd"
    {...props}
  >
    <defs>
      <linearGradient id="entra-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8A3FFC" />
        <stop offset="100%" stopColor="#0078D4" />
      </linearGradient>
    </defs>
    <path
      fill="url(#entra-gradient)"
      d="M16.14 3.23a8.87 8.87 0 00-7.28 0l-.36.2a.75.75 0 00-.33.64v15.86c0 .3.16.57.42.7l.25.14a8.87 8.87 0 007.32 0l.25-.14a.75.75 0 00.42-.7V4.07a.75.75 0 00-.33-.64l-.36-.2z M7 12a5 5 0 1010 0 5 5 0 00-10 0z"
    />
  </svg>
);

export default MicrosoftIcon;
