
import React from 'react';

const KeyboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <rect x="2" y="7" width="20" height="13" rx="2" ry="2"></rect>
    <path d="M4 11h.01"></path>
    <path d="M8 11h.01"></path>
    <path d="M12 11h.01"></path>
    <path d="M16 11h.01"></path>
    <path d="M7 15h10"></path>
  </svg>
);

export default KeyboardIcon;
