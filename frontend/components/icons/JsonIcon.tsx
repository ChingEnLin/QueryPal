
import React from 'react';

const JsonIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M10 12.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5" />
    <path d="M14 12.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5" />
    <path d="M10 9.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5" />
    <path d="M14 15.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5" />
    <path d="M10 15.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5" />
    <path d="M4 6V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
  </svg>
);

export default JsonIcon;
