import React from 'react';

// Thumbtack icon: flat head, angled body, and sharp point
const PinIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    {/* Flat head */}
    <rect x="7" y="3.5" width="10" height="3" rx="1.2" fill="currentColor" stroke="currentColor" strokeWidth={1} />
    {/* Angled body */}
    <path d="M12 6.5 L16.5 14.5 Q17 15.5 16 16.2 L13.5 18 Q12.7 18.6 12 17.7 Q11.3 18.6 10.5 18 L8 16.2 Q7 15.5 7.5 14.5 L12 6.5 Z" fill="currentColor" stroke="currentColor" strokeWidth={1} />
    {/* Pin point */}
    <path d="M12 18 L12 21" stroke="currentColor" strokeWidth={2} />
    {/* Subtle shadow */}
    <ellipse cx="12" cy="22" rx="2.2" ry="0.5" fill="currentColor" opacity="0.13" />
  </svg>
);

export default PinIcon;
