
import React, { useState, useMemo } from 'react';
import ArrowUpIcon from './icons/ArrowUpIcon';
import ArrowDownIcon from './icons/ArrowDownIcon';

interface TableProps {
  data: Record<string, any>[];
}

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
} | null;

const Table: React.FC<TableProps> = ({ data }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const headers = useMemo(() => {
        if (data.length === 0) return [];
        // Get all unique keys from all objects
        const keySet = new Set<string>();
        data.forEach(row => {
            Object.keys(row).forEach(key => keySet.add(key));
        });
        return Array.from(keySet);
    }, [data]);
    
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
            return <em className="text-slate-400">null</em>;
        }
        if (typeof item === 'object') {
            return <code className="text-xs bg-slate-200/50 p-1 rounded-sm">{JSON.stringify(item)}</code>
        }
        return String(item);
    }

    return (
        <div className="w-full overflow-x-auto bg-white border border-slate-200 rounded-lg">
            <table className="min-w-full text-sm text-left text-slate-600">
                <thead className="bg-slate-100 text-xs text-slate-700 uppercase">
                    <tr>
                        {headers.map(key => (
                            <th key={key} scope="col" className="px-6 py-3">
                                <button 
                                    onClick={() => requestSort(key)}
                                    className="flex items-center gap-1.5 hover:text-slate-900"
                                >
                                    {key}
                                    {getSortIcon(key)}
                                </button>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((row, rowIndex) => (
                        <tr key={rowIndex} className="bg-white border-b border-slate-200 hover:bg-slate-50">
                            {headers.map(header => (
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
