import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PgRowDrawer from '../components/PgRowDrawer';

const columns = [
  { name: 'id', type: 'integer', nullable: false, pk: true, fk: null },
  { name: 'status', type: 'text', nullable: true, pk: false, fk: null },
];

describe('PgRowDrawer', () => {
  it('edits a field and saves only non-pk values', async () => {
    const onSave = vi.fn();
    render(
      <PgRowDrawer columns={columns} pk={['id']} mode="edit"
        row={{ id: 7, status: 'paid' }} onClose={() => {}} onSave={onSave} onDelete={() => {}} />,
    );
    const input = screen.getByLabelText('status') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'refunded' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith({ status: 'refunded' });
  });
});
