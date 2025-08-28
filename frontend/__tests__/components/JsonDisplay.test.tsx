import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import JsonDisplay from '../../components/JsonDisplay';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

describe('JsonDisplay ObjectId Copy Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render ObjectId with copy button for BSON ObjectId format', async () => {
    const mockData = {
      _id: { $oid: '507f1f77bcf86cd799439011' }
    };
    const mockOnObjectIdClick = vi.fn();

    render(<JsonDisplay data={mockData} onObjectIdClick={mockOnObjectIdClick} />);

    // Check that ObjectId is rendered
    expect(screen.getByText('ObjectId')).toBeInTheDocument();
    expect(screen.getByText('"507f1f77bcf86cd799439011"')).toBeInTheDocument();

    // Find the copy button (should be hidden initially)
    const copyButton = screen.getByLabelText('Copy ObjectId');
    expect(copyButton).toBeInTheDocument();

    // Click the copy button
    fireEvent.click(copyButton);

    // Verify clipboard was called
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('507f1f77bcf86cd799439011');

    // Check for success indicator
    await waitFor(() => {
      expect(screen.getByTitle('Copied!')).toBeInTheDocument();
    });
  });

  it('should render ObjectId with copy button for ObjectId-like strings', async () => {
    const mockData = {
      refId: '507f1f77bcf86cd799439012'
    };
    const mockOnObjectIdClick = vi.fn();

    render(<JsonDisplay data={mockData} onObjectIdClick={mockOnObjectIdClick} />);

    // Check that ObjectId-like string is rendered as clickable
    expect(screen.getByText('"507f1f77bcf86cd799439012"')).toBeInTheDocument();

    // Find the copy button
    const copyButton = screen.getByLabelText('Copy ObjectId');
    expect(copyButton).toBeInTheDocument();

    // Click the copy button
    fireEvent.click(copyButton);

    // Verify clipboard was called
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
  });

  it('should call onObjectIdClick when clicking the ObjectId link', () => {
    const mockData = {
      _id: { $oid: '507f1f77bcf86cd799439013' }
    };
    const mockOnObjectIdClick = vi.fn();

    render(<JsonDisplay data={mockData} onObjectIdClick={mockOnObjectIdClick} />);

    // Click the ObjectId link
    const objectIdLink = screen.getByText('"507f1f77bcf86cd799439013"');
    fireEvent.click(objectIdLink);

    // Verify the click handler was called
    expect(mockOnObjectIdClick).toHaveBeenCalledWith('507f1f77bcf86cd799439013', '_id');
  });

  it('should not call onObjectIdClick when clicking the copy button', () => {
    const mockData = {
      _id: { $oid: '507f1f77bcf86cd799439014' }
    };
    const mockOnObjectIdClick = vi.fn();

    render(<JsonDisplay data={mockData} onObjectIdClick={mockOnObjectIdClick} />);

    // Click the copy button
    const copyButton = screen.getByLabelText('Copy ObjectId');
    fireEvent.click(copyButton);

    // Verify onObjectIdClick was NOT called (copy action should not trigger navigation)
    expect(mockOnObjectIdClick).not.toHaveBeenCalled();
  });

  it('should handle clipboard errors gracefully', async () => {
    const mockData = {
      _id: { $oid: '507f1f77bcf86cd799439015' }
    };

    // Mock clipboard to reject
    (navigator.clipboard.writeText as any).mockRejectedValueOnce(new Error('Clipboard error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<JsonDisplay data={mockData} onObjectIdClick={vi.fn()} />);

    // Click the copy button
    const copyButton = screen.getByLabelText('Copy ObjectId');
    fireEvent.click(copyButton);

    // Wait for error handling
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy ObjectId:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});
