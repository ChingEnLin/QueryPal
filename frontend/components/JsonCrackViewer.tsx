import React from 'react';
import ReactJson from 'react-json-view';

interface JsonCrackViewerProps {
  data: any;
}

const JsonCrackViewer: React.FC<JsonCrackViewerProps> = ({ data }) => {
  return (
    <div className="h-full w-full rounded-lg overflow-auto bg-gray-900 p-2">
      <ReactJson
        src={data}
        theme="monokai"
        iconStyle="circle"
        displayDataTypes={false}
        enableClipboard={true}
        collapsed={2}
        name={false}
        style={{ fontSize: '1rem', background: 'transparent' }}
      />
    </div>
  );
};

export default JsonCrackViewer;
