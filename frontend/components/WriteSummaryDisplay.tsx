
import React from 'react';
import CheckIcon from './icons/CheckIcon';
import FilterIcon from './icons/FilterIcon';
import EditIcon from './icons/EditIcon';
import PlusCircleIcon from './icons/PlusCircleIcon';
import TrashIcon from './icons/TrashIcon';
import TagIcon from './icons/TagIcon';

interface WriteSummaryDisplayProps {
  data: Record<string, any>;
}

const iconSize = "w-6 h-6";

// Maps API response keys to human-readable labels and icons
const keyMappings: Record<string, { label: string; icon: React.ReactNode }> = {
  acknowledged: { label: 'Acknowledged', icon: <CheckIcon className={iconSize} /> },
  matchedCount: { label: 'Documents Matched', icon: <FilterIcon className={iconSize} /> },
  matched_count: { label: 'Documents Matched', icon: <FilterIcon className={iconSize} /> },
  modifiedCount: { label: 'Documents Modified', icon: <EditIcon className={iconSize} /> },
  modified_count: { label: 'Documents Modified', icon: <EditIcon className={iconSize} /> },
  upsertedCount: { label: 'Documents Upserted', icon: <PlusCircleIcon className={iconSize} /> },
  upserted_count: { label: 'Documents Upserted', icon: <PlusCircleIcon className={iconSize} /> },
  upsertedId: { label: 'Upserted ID', icon: <TagIcon className={iconSize} /> },
  upserted_id: { label: 'Upserted ID', icon: <TagIcon className={iconSize} /> },
  deletedCount: { label: 'Documents Deleted', icon: <TrashIcon className={iconSize} /> },
  deleted_count: { label: 'Documents Deleted', icon: <TrashIcon className={iconSize} /> },
  insertedId: { label: 'Inserted ID', icon: <TagIcon className={iconSize} /> },
  inserted_id: { label: 'Inserted ID', icon: <TagIcon className={iconSize} /> },
  insertedCount: { label: 'Documents Inserted', icon: <PlusCircleIcon className={iconSize} /> },
  inserted_count: { label: 'Documents Inserted', icon: <PlusCircleIcon className={iconSize} /> },
  insertedIds: { label: 'Inserted IDs', icon: <TagIcon className={iconSize} /> },
};

const WriteSummaryDisplay: React.FC<WriteSummaryDisplayProps> = ({ data }) => {
  // Filter and map the data to ensure we only display known, relevant keys
  const displayEntries = Object.entries(data)
    .map(([key, value]) => ({ key, value, mapping: keyMappings[key] }))
    .filter(item => item.mapping);

  return (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm animate-fade-in">
      <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-3">
        <CheckIcon className="w-7 h-7 text-green-500 p-1 bg-green-100 rounded-full" />
        Operation Successful
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayEntries.map(({ key, value, mapping }) => {
          let displayValue;
          if (typeof value === 'boolean') {
            displayValue = <span className={`font-bold ${value ? 'text-green-600' : 'text-red-600'}`}>{value ? 'Yes' : 'No'}</span>;
          } else if (value === null) {
            displayValue = <span className="text-slate-500">None</span>;
          } else if (typeof value === 'object') {
            displayValue = <code className="text-xs bg-slate-200 p-1 rounded-sm">{JSON.stringify(value)}</code>;
          } else {
            displayValue = <span className="text-slate-900">{value.toLocaleString()}</span>;
          }

          return (
            <div key={key} className="bg-slate-50 p-4 rounded-lg flex items-center gap-4 ring-1 ring-slate-200/80">
              <div className="flex-shrink-0 text-blue-600 bg-blue-100 rounded-full p-2.5">
                {mapping.icon}
              </div>
              <div>
                <p className="text-sm text-slate-600 font-medium">{mapping.label}</p>
                <p className="text-2xl font-bold">{displayValue}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WriteSummaryDisplay;
