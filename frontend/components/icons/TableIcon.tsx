
import React from 'react';

const TableIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M12 3H20V21H4V3H12Z" />
    <path d="M4 9H20" />
    <path d="M12 3V21" />
  </svg>
);

export default TableIcon;
