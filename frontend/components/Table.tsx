
import React, { useState, useMemo, useEffect } from 'react';
import ArrowUpIcon from './icons/ArrowUpIcon';
import ArrowDownIcon from './icons/ArrowDownIcon';
import XIcon from './icons/XIcon';

interface TableProps {
  data: Record<string, any>[];
  isEditMode: boolean;
  visibleHeaders: string[];
  onDeleteColumn: (header: string) => void;
}

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
} | null;

const Table: React.FC<TableProps> = ({ data, isEditMode, visibleHeaders, onDeleteColumn }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    
    const sortedData = useMemo(() => {
        let sortableData = [...data];
        if (sortConfig !== null) {
            sortableData.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];

                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;
                
                if (valA < valB) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableData;
    }, [data, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) {
            return null;
        }
        return sortConfig.direction === 'asc' ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />;
    }

    const renderCell = (item: any) => {
        if (item === null || item === undefined) {
            return <em className="text-slate-400 dark:text-slate-500">null</em>;
        }
        if (typeof item === 'object') {
            return <code className="text-xs bg-slate-200/50 dark:bg-slate-700 p-1 rounded-sm">{JSON.stringify(item)}</code>
        }
        return String(item);
    }

    return (
        <div className="w-full overflow-x-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="min-w-full text-sm text-left text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-700/50 text-xs text-slate-700 dark:text-slate-400 uppercase">
                    <tr>
                        {visibleHeaders.map(key => (
                            <th key={key} scope="col" className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => requestSort(key)}
                                        className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white disabled:hover:text-inherit dark:disabled:hover:text-inherit"
                                        disabled={isEditMode}
                                        title={`Sort by ${key}`}
                                    >
                                        {key}
                                        {getSortIcon(key)}
                                    </button>
                                    {isEditMode && (
                                        <button 
                                            onClick={() => onDeleteColumn(key)}
                                            className="p-1 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50"
                                            aria-label={`Delete ${key} column`}
                                            title={`Delete ${key} column`}
                                        >
                                            <XIcon className="w-3 h-3"/>
                                        </button>
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((row, rowIndex) => (
                        <tr key={rowIndex} className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70">
                            {visibleHeaders.map(header => (
                                <td key={`${rowIndex}-${header}`} className="px-6 py-4 font-mono">
                                    {renderCell(row[header])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Table;
