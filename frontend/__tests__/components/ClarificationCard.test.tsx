import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import ClarificationCard from '../../components/ClarificationCard';

describe('ClarificationCard', () => {
  const questions = [
    'What defines an "active" record?',
    'What time frame does "recent" refer to?',
  ];

  it('renders all clarifying questions', () => {
    render(<ClarificationCard questions={questions} onSubmit={vi.fn()} />);
    questions.forEach((q) => {
      expect(screen.getByText(q)).toBeInTheDocument();
    });
  });

  it('disables the submit button until the user types an answer', () => {
    render(<ClarificationCard questions={questions} onSubmit={vi.fn()} />);
    const button = screen.getByRole('button', { name: /regenerate with details/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/additional details/i), {
      target: { value: 'status === "enabled"; last 30 days' },
    });
    expect(button).toBeEnabled();
  });

  it('calls onSubmit with the trimmed answers on click', () => {
    const onSubmit = vi.fn();
    render(<ClarificationCard questions={questions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/additional details/i), {
      target: { value: '  last 7 days  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /regenerate with details/i }));

    expect(onSubmit).toHaveBeenCalledWith('last 7 days');
  });

  it('submits on Cmd/Ctrl+Enter', () => {
    const onSubmit = vi.fn();
    render(<ClarificationCard questions={questions} onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText(/additional details/i);
    fireEvent.change(textarea, { target: { value: 'enabled devices' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

    expect(onSubmit).toHaveBeenCalledWith('enabled devices');
  });

  it('shows a loading state and blocks submission while regenerating', () => {
    const onSubmit = vi.fn();
    render(<ClarificationCard questions={questions} onSubmit={onSubmit} isLoading />);

    const button = screen.getByRole('button', { name: /regenerating/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
