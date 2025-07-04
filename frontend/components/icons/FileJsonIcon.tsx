import React from 'react';

const FileJsonIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <path d="M10 12.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5"></path>
    <path d="M14 12.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5"></path>
    <path d="M12 15a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1"></path>
  </svg>
);

export default FileJsonIcon;
