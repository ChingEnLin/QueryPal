import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
import { API_BASE_URL } from '../app.config';
import NavBar from '../components/NavBar';
import ChartDisplay, { VisualizationConfig } from '../components/ChartDisplay';
import styles from './AuditPage.module.css';

interface AuditResult {
    sql_query: string;
    results: any[];
    summary: string;
    visualization?: VisualizationConfig;
}

const AuditPage: React.FC = () => {
    const { getToken } = useUnifiedAuth();
    const [question, setQuestion] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<AuditResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim()) return;

        setLoading(true);
        setError(null);
        setData(null);

        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/audit/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ question })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch audit data');
            }

            const result = await response.json();
            setData(result);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <NavBar />
            <div className={styles.content}>
                <h1 className={styles.title}>Audit Log Analysis</h1>
                <p className={styles.subtitle}>Ask questions about your write operations history</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <textarea
                        className={styles.input}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="e.g., How many documents were deleted yesterday?"
                        rows={3}
                    />
                    <button type="submit" className={styles.button} disabled={loading}>
                        {loading ? 'Analyzing...' : 'Analyze'}
                    </button>
                </form>

                {error && <div className={styles.error}>{error}</div>}

                {data && (
                    <div className={styles.resultsContainer}>
                        <div className={styles.summarySection}>
                            <h2>AI Insight</h2>
                            <div className={styles.markdown}>
                                <ReactMarkdown>{data.summary}</ReactMarkdown>
                            </div>
                        </div>

                        {data.visualization && (
                            <ChartDisplay config={data.visualization} data={data.results} />
                        )}

                        <div className={styles.detailsSection}>
                            <details>
                                <summary>View SQL Query</summary>
                                <code className={styles.sqlBlock}>{data.sql_query}</code>
                            </details>

                            <h3>Raw Data ({data.results.length} rows)</h3>
                            {data.results.length > 0 ? (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                {Object.keys(data.results[0]).map((key) => (
                                                    <th key={key}>{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.results.map((row, i) => (
                                                <tr key={i}>
                                                    {Object.values(row).map((val: any, j) => (
                                                        <td key={j}>
                                                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p>No results found.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditPage;
