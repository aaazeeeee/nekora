import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPage';
import { authService } from './auth.service';
vi.mock('../../lib/supabase/client', () => ({ isConfigured: true }));
vi.mock('./auth.service', () => ({
  authService: {
    signUp: vi.fn(),
    signIn: vi.fn(),
    confirmEmail: vi.fn(),
    resendConfirmation: vi.fn(),
  },
}));
beforeEach(() => vi.resetAllMocks());
it('confirms signup with an emailed code, retains the form on failure, and resends', async () => {
  vi.mocked(authService.signUp).mockResolvedValue(false);
  vi.mocked(authService.confirmEmail).mockRejectedValueOnce(
    new Error('Code expired'),
  );
  render(<AuthPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
  fireEvent.change(screen.getByLabelText('Your name'), {
    target: { value: 'Alex' },
  });
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'alex@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'password1234' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  const code = await screen.findByLabelText('Confirmation code');
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  fireEvent.change(code, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Code expired');
  expect(code).toHaveValue('123456');
  fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
  await waitFor(() =>
    expect(authService.resendConfirmation).toHaveBeenCalledWith(
      'alex@example.com',
    ),
  );
  await screen.findByText('A new confirmation code has been sent.');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }));
  await waitFor(() =>
    expect(authService.confirmEmail).toHaveBeenLastCalledWith(
      'alex@example.com',
      '123456',
    ),
  );
});
