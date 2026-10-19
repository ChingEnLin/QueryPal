import React, { useState } from 'react';

interface ClarificationCardProps {
  /** Questions the agent needs answered before it can write a correct query. */
  questions: string[];
  /** Called with the user's free-text answers to re-run generation. */
  onSubmit: (answers: string) => void;
  /** True while the follow-up generation is in flight. */
  isLoading?: boolean;
}

/**
 * Rendered when the query generator's triage gate decides the request is too
 * vague to answer correctly. Instead of a (likely wrong) query, it shows the
 * blocking questions and lets the user add detail, then regenerates.
 */
const ClarificationCard: React.FC<ClarificationCardProps> = ({ questions, onSubmit, isLoading = false }) => {
  const [answers, setAnswers] = useState('');

  const canSubmit = answers.trim().length > 0 && !isLoading;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(answers.trim());
  };

  return (
    <div
      className="qa-card"
      style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--status-warn)' }}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>
          A bit more detail needed
        </span>
      </div>

      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)' }}>
        Your request is a little ambiguous. Answer the question{questions.length > 1 ? 's' : ''} below and
        I&apos;ll generate a more accurate query.
      </p>

      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q, i) => (
          <li
            key={i}
            style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--fg)', lineHeight: 1.5 }}
          >
            {q}
          </li>
        ))}
      </ul>

      <textarea
        value={answers}
        onChange={(e) => setAnswers(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
        }}
        disabled={isLoading}
        rows={4}
        placeholder="Add the missing details here…"
        aria-label="Additional details"
        style={{
          width: '100%',
          resize: 'vertical',
          padding: '10px 12px',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--fg)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="qa-btn primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {isLoading ? 'Regenerating…' : 'Regenerate with details'}
        </button>
      </div>
    </div>
  );
};

export default ClarificationCard;
