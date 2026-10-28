import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './dialog';
describe('accessible dialog', () => {
  it('exposes its name and description and supports Escape', () => {
    const close = vi.fn();
    render(
      <Dialog
        open
        onOpenChange={close}
        title="Share document"
        description="Invite an existing user."
      >
        <button>Give access</button>
      </Dialog>,
    );
    expect(
      screen.getByRole('dialog', { name: 'Share document' }),
    ).toHaveAccessibleDescription('Invite an existing user.');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(close).toHaveBeenCalledWith(false);
  });
});
