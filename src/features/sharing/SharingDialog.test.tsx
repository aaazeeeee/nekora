import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SharingDialog } from './SharingDialog';
const { list, grant, listRequests, resolveRequest } = vi.hoisted(() => ({
  list: vi.fn(),
  grant: vi.fn(),
  listRequests: vi.fn(),
  resolveRequest: vi.fn(),
}));
vi.mock('./sharing.service', () => ({
  sharingService: {
    list,
    grant,
    revoke: vi.fn(),
    listRequests,
    resolveRequest,
  },
}));
describe('sharing dialog links', () => {
  afterEach(cleanup);
  beforeEach(() => {
    list.mockResolvedValue([]);
    listRequests.mockResolvedValue([]);
    resolveRequest.mockResolvedValue(undefined);
    grant.mockResolvedValue(undefined);
  });
  function renderDialog() {
    render(<SharingDialog id="document-id" open onOpenChange={vi.fn()} />);
  }
  it('copies the document URL while keeping email invitations available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Link copied.')).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/documents/document-id`,
    );
    expect(
      screen.getByText(/Only people with access can open it/),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Give access' })).toBeEnabled(),
    );
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'writer@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Give access' }));
    await waitFor(() =>
      expect(grant).toHaveBeenCalledWith(
        'document-id',
        'writer@example.com',
        'editor',
      ),
    );
  });
  it('lets owners approve a pending request with view permission', async () => {
    listRequests.mockResolvedValue([
      {
        user_id: 'recipient',
        display_name: 'Writer',
        email: 'writer@example.com',
      },
    ]);
    renderDialog();
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Allow writer@example.com to view',
      }),
    );
    await waitFor(() =>
      expect(resolveRequest).toHaveBeenCalledWith(
        'document-id',
        'recipient',
        'viewer',
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: 'Allow writer@example.com to view',
        }),
      ).not.toBeInTheDocument(),
    );
  });
  it('offers manual copying when clipboard access fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
    });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'copy it manually',
    );
    expect(screen.getByRole('textbox', { name: 'Document link' })).toHaveValue(
      `${window.location.origin}/documents/document-id`,
    );
    expect(
      screen.queryByRole('button', { name: 'Copied' }),
    ).not.toBeInTheDocument();
  });
});
