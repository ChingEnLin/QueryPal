import React, { useEffect, useRef, useState } from 'react';

interface JsonCrackViewerProps {
  data: any;
}

const JsonCrackViewer: React.FC<JsonCrackViewerProps> = ({ data }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  useEffect(() => {
    // This effect sends data to the iframe whenever the data changes,
    // but only if the iframe has been loaded.
    if (isIframeLoaded && iframeRef.current?.contentWindow) {
      const json = JSON.stringify(data, null, 2); // Prettify the JSON string
      const options = {
        theme: 'dark', // The container has a dark background
        direction: 'RIGHT',
      };
      // Post the message to the iframe
      iframeRef.current.contentWindow.postMessage({ json, options }, '*');
    }
  }, [data, isIframeLoaded]); // Rerun when data or iframe load status changes

  return (
    <div className="h-full w-full rounded-lg overflow-hidden">
      <iframe
        ref={iframeRef}
        src="https://jsoncrack.com/widget"
        width="100%"
        height="100%"
        frameBorder="0"
        onLoad={() => setIsIframeLoaded(true)} // Set loaded state to true when iframe finishes loading
        title="JSON Crack Viewer"
      ></iframe>
    </div>
  );
};

export default JsonCrackViewer;
