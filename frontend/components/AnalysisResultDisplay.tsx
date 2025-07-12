
import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, PolarAreaController, RadarController, DoughnutController, PieController, BarController, LineController, ScatterController, BubbleController } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { AnalysisResult } from '../types';
import AiSparkleIcon from './icons/AiSparkleIcon';
import { useTheme } from '../contexts/ThemeContext';

// Register all necessary Chart.js components
ChartJS.register(
    CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, 
    PolarAreaController, RadarController, DoughnutController, PieController, BarController, LineController,
    ScatterController, BubbleController
);

interface AnalysisResultDisplayProps {
    result: AnalysisResult;
}

const AnalysisResultDisplay: React.FC<AnalysisResultDisplayProps> = ({ result }) => {
    const { theme } = useTheme();

    // Dynamically adjust chart options for dark/light theme
    const themedChartOptions = React.useMemo(() => {
        const isDark = theme === 'dark';
        const textColor = isDark ? '#cbd5e1' : '#475569'; // slate-300 : slate-600
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        // Deep merge our theme options into the AI-provided options
        const baseOptions = result.chartOptions || {};
        
        const themeOverrides = {
            plugins: {
                legend: {
                    labels: { color: textColor }
                },
                title: {
                    color: textColor
                }
            },
            scales: {
                x: {
                    ...baseOptions.scales?.x,
                    ticks: { ...baseOptions.scales?.x?.ticks, color: textColor },
                    grid: { ...baseOptions.scales?.x?.grid, color: gridColor },
                    title: { ...baseOptions.scales?.x?.title, color: textColor }
                },
                y: {
                    ...baseOptions.scales?.y,
                    ticks: { ...baseOptions.scales?.y?.ticks, color: textColor },
                    grid: { ...baseOptions.scales?.y?.grid, color: gridColor },
                    title: { ...baseOptions.scales?.y?.title, color: textColor }
                }
            }
        };
        
        // A simple deep merge
        return {
            ...baseOptions,
            ...themeOverrides,
            plugins: { ...baseOptions.plugins, ...themeOverrides.plugins },
            scales: { ...baseOptions.scales, ...themeOverrides.scales }
        };

    }, [result.chartOptions, theme]);

    return (
        <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">AI Analysis</h3>
            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-6 flex flex-col md:flex-row gap-6">
                {/* Insight Text */}
                <div className="md:w-1/3 space-y-4">
                    <div className="flex items-center gap-3">
                        <AiSparkleIcon className="w-7 h-7 text-blue-500 flex-shrink-0" />
                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Insight</h4>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                        {result.insight}
                    </p>
                </div>
                {/* Chart */}
                <div className="md:w-2/3 min-h-[300px]">
                    <Chart 
                        type={result.chartType} 
                        data={result.chartData} 
                        options={themedChartOptions} 
                    />
                </div>
            </div>
        </div>
    );
};

export default AnalysisResultDisplay;
