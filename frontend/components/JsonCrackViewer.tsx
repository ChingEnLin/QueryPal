
import React from 'react';
import { JsonView, darkStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

interface JsonCrackViewerProps {
  data: any;
}


const JsonCrackViewer: React.FC<JsonCrackViewerProps> = ({ data }) => {
  return (
    <div className="h-full w-full rounded-lg overflow-auto bg-gray-900 p-2">
      <JsonView
        data={data}
        style={darkStyles}
        enableClipboard
        displayDataTypes={false}
        collapsed={2}
      />
    </div>
  );
};

export default JsonCrackViewer;
