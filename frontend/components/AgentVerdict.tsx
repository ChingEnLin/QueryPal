import React from 'react';

interface AgentVerdictProps {
  isValid?: boolean;
  explanation?: string;
}

/**
 * Surfaces the ReAct agent's self-evaluation from the generate -> test-execute ->
 * evaluate loop: whether it validated the query against the request, plus its
 * critique. Shared by the Cosmos and PostgreSQL query workspaces.
 */
const AgentVerdict: React.FC<AgentVerdictProps> = ({ isValid, explanation }) => {
  if (isValid === undefined && !explanation) return null;
  const ok = isValid === true;
  const tone = ok ? 'var(--status-ok)' : 'var(--status-warn)';
  return (
    <div
      className="qa-card"
      style={{
        padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
        borderColor: `color-mix(in oklch, ${tone} 35%, var(--border))`,
      }}
    >
      <span
        className="qa-chip"
        style={{ flexShrink: 0, background: `color-mix(in oklch, ${tone} 15%, var(--bg))`, color: tone, borderColor: 'transparent' }}
        title="The AI ran and evaluated this query against your request during generation"
      >
        {ok ? '✓ Validated' : '⚠ Needs review'}
      </span>
      {explanation && (
        <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>{explanation}</span>
      )}
    </div>
  );
};

export default AgentVerdict;
