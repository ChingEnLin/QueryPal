import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
import { API_BASE_URL } from '../app.config';
import AppLayout from '../components/AppLayout';
import ChartDisplay, { VisualizationConfig } from '../components/ChartDisplay';

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
        <AppLayout>
            <div style={{ padding: '32px 40px', maxWidth: 860, fontFamily: 'var(--font-body)' }}>
                <div style={{ marginBottom: 28 }}>
                    <h1 style={{
                        fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22,
                        letterSpacing: '-0.02em', margin: 0, color: 'var(--fg)',
                    }}>Audit Log Analysis</h1>
                    <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0 0' }}>
                        Ask questions about your write operations history
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                    <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="e.g., How many documents were deleted yesterday?"
                        rows={3}
                        style={{
                            padding: '10px 14px',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            background: 'var(--panel)',
                            color: 'var(--fg)',
                            fontFamily: 'var(--font-body)',
                            fontSize: 13.5,
                            resize: 'vertical',
                            outline: 'none',
                            lineHeight: 1.5,
                        }}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                    />
                    <button
                        type="submit"
                        className="qa-btn primary"
                        disabled={loading}
                        style={{ alignSelf: 'flex-start', opacity: loading ? 0.65 : 1 }}
                    >
                        {loading ? 'Analyzing…' : 'Analyze'}
                    </button>
                </form>

                {error && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 10,
                        background: 'color-mix(in oklch, var(--status-err) 12%, var(--bg))',
                        border: '1px solid color-mix(in oklch, var(--status-err) 25%, var(--border))',
                        color: 'var(--status-err)', fontSize: 13, marginBottom: 20,
                    }}>
                        {error}
                    </div>
                )}

                {data && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 12 }}>
                                AI Insight
                            </div>
                            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--fg)' }}>
                                <ReactMarkdown>{data.summary}</ReactMarkdown>
                            </div>
                        </div>

                        {data.visualization && (
                            <ChartDisplay config={data.visualization} data={data.results} />
                        )}

                        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
                            <details>
                                <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>
                                    View SQL Query
                                </summary>
                                <pre style={{
                                    fontFamily: 'var(--font-mono)', fontSize: 12,
                                    background: 'var(--soft)', borderRadius: 8, padding: '12px 14px',
                                    overflowX: 'auto', color: 'var(--fg)', margin: '8px 0 0',
                                }}>{data.sql_query}</pre>
                            </details>

                            <div style={{ marginTop: 20 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--muted)', marginBottom: 10 }}>
                                    Raw data <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>({data.results.length} rows)</span>
                                </div>
                                {data.results.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                    {Object.keys(data.results[0]).map((key) => (
                                                        <th key={key} style={{
                                                            padding: '7px 10px', textAlign: 'left',
                                                            fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em',
                                                            color: 'var(--muted)', fontWeight: 500,
                                                        }}>{key}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.results.map((row, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        {Object.values(row).map((val: any, j) => (
                                                            <td key={j} style={{ padding: '8px 10px', color: 'var(--fg)' }}>
                                                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--muted)', fontSize: 13 }}>No results found.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default AuditPage;
