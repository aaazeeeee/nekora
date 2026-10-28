import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RequestAccess } from './RequestAccess';
const requestAccess = vi.hoisted(() => vi.fn());
vi.mock('./sharing.service', () => ({ sharingService: { requestAccess } }));
afterEach(cleanup);
describe('request access', () => {
  it('submits once and confirms only after the request succeeds', async () => {
    requestAccess.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <RequestAccess id="doc" email="aze@example.com" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Request access' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'owner can review',
    );
    expect(requestAccess).toHaveBeenCalledWith('doc');
    expect(screen.getByRole('button', { name: 'Request sent' })).toBeDisabled();
    expect(screen.getByText('Signed in as aze@example.com')).toBeVisible();
  });
  it('shows failures and allows retrying', async () => {
    requestAccess.mockRejectedValue(new Error('Check your connection.'));
    render(
      <MemoryRouter>
        <RequestAccess id="doc" email="aze@example.com" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Request access' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your connection.',
    );
    expect(
      screen.getByRole('button', { name: 'Request access' }),
    ).toBeEnabled();
  });
});
