import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PgRowDrawer from '../components/PgRowDrawer';

const columns = [
  { name: 'id', type: 'integer', nullable: false, pk: true, fk: null },
  { name: 'status', type: 'text', nullable: true, pk: false, fk: null },
];

describe('PgRowDrawer', () => {
  it('parses a json column value on save', () => {
    const onSave = vi.fn();
    const cols = [
      { name: 'id', type: 'integer', nullable: false, pk: true, fk: null },
      { name: 'meta', type: 'jsonb', nullable: true, pk: false, fk: null },
    ];
    render(
      <PgRowDrawer columns={cols} pk={['id']} mode="edit"
        row={{ id: 1, meta: {} }} onClose={() => {}} onSave={onSave} onDelete={() => {}} />,
    );
    const ta = screen.getByLabelText('meta') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith({ meta: { a: 1 } });
  });

  const arrayCols = [
    { name: 'id', type: 'integer', nullable: false, pk: true, fk: null },
    { name: 'tags', type: 'ARRAY', nullable: true, pk: false, fk: null },
  ];

  it('parses JSON array input into a JS array on save', () => {
    const onSave = vi.fn();
    render(
      <PgRowDrawer columns={arrayCols} pk={['id']} mode="edit"
        row={{ id: 1, tags: null }} onClose={() => {}} onSave={onSave} onDelete={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText('tags'), { target: { value: '[1,3]' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith({ tags: [1, 3] });
  });

  it('parses PG {..} array literal input into a JS array on save', () => {
    const onSave = vi.fn();
    render(
      <PgRowDrawer columns={arrayCols} pk={['id']} mode="edit"
        row={{ id: 1, tags: null }} onClose={() => {}} onSave={onSave} onDelete={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText('tags'), { target: { value: '{1,3}' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith({ tags: [1, 3] });
  });

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
