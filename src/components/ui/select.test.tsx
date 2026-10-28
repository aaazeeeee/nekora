import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './select';
const OPTIONS = [
  { value: 'editor', label: 'Can edit', description: 'Write and rename' },
  { value: 'viewer', label: 'Can view', description: 'Read only' },
] as const;
describe('select', () => {
  it('shows the selected label and reports a keyboard choice', () => {
    const change = vi.fn();
    render(
      <Select
        aria-label="Permission"
        value="editor"
        onValueChange={change}
        options={OPTIONS}
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Permission' });
    expect(trigger).toHaveTextContent('Can edit');
    expect(trigger).not.toHaveTextContent('Write and rename');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('option', { name: /Can view/ })).toHaveTextContent(
      'Read only',
    );
    fireEvent.keyDown(screen.getByRole('option', { name: /Can edit/ }), {
      key: 'ArrowDown',
    });
    fireEvent.keyDown(screen.getByRole('option', { name: /Can view/ }), {
      key: 'Enter',
    });
    expect(change).toHaveBeenCalledWith('viewer');
  });
});
