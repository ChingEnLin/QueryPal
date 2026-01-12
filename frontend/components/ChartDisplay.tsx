import React from 'react';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';

export interface VisualizationConfig {
    available: boolean;
    type?: 'bar' | 'line' | 'pie' | 'scatter';
    x_key?: string;
    y_key?: string;
    title?: string;
    data_keys?: string[];
}

interface ChartDisplayProps {
    config: VisualizationConfig;
    data: any[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const ChartDisplay: React.FC<ChartDisplayProps> = ({ config, data }) => {
    if (!config.available || !config.type || data.length === 0) {
        return null;
    }

    // Pre-process data if needed (e.g. converting date strings)
    const chartData = data.map(item => ({
        ...item,
        // Create a display label for X axis if x_key exists
        ...(config.x_key && { [config.x_key]: item[config.x_key] })
    }));

    const renderChart = () => {
        switch (config.type) {
            case 'bar':
                return (
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey={config.x_key}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                        {(config.data_keys || [config.y_key]).map((key, index) => (
                            key && <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} radius={[4, 4, 0, 0]} />
                        ))}
                    </BarChart>
                );

            case 'line':
                return (
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey={config.x_key}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                        {(config.data_keys || [config.y_key]).map((key, index) => (
                            key && <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                        ))}
                    </LineChart>
                );

            case 'pie':
                // For pie charts, we typically visualizing distribution of one key
                const pieDataKey = config.data_keys?.[0] || config.y_key || 'count';
                const nameKey = config.x_key || 'name';

                return (
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey={pieDataKey}
                            nameKey={nameKey}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                    </PieChart>
                );

            default:
                return null;
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden p-6 mb-8">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 text-center">
                {config.title || 'Data Visualization'}
            </h3>
            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart() || <div>Unable to render chart</div>}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ChartDisplay;
