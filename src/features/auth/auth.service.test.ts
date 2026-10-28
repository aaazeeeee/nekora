import { beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ verifyOtp: vi.fn(), resend: vi.fn() }));
vi.mock('../../lib/supabase/client', () => ({ getClient: () => ({ auth }) }));
import { authService } from './auth.service';
beforeEach(() => vi.resetAllMocks());
it('verifies the signup token through Supabase', async () => {
  auth.verifyOtp.mockResolvedValue({ error: null });
  await authService.confirmEmail('alex@example.com', ' 123456 ');
  expect(auth.verifyOtp).toHaveBeenCalledWith({
    email: 'alex@example.com',
    token: '123456',
    type: 'signup',
  });
});
it('rejects malformed codes before calling Supabase', async () => {
  await expect(
    authService.confirmEmail('alex@example.com', 'abc'),
  ).rejects.toThrow('numeric');
  expect(auth.verifyOtp).not.toHaveBeenCalled();
});
it('handles expired tokens and resend rate limits', async () => {
  auth.verifyOtp.mockResolvedValue({ error: { message: 'expired' } });
  await expect(
    authService.confirmEmail('alex@example.com', '123456'),
  ).rejects.toThrow('invalid or expired');
  auth.resend.mockResolvedValue({ error: { message: 'rate limit' } });
  await expect(
    authService.resendConfirmation('alex@example.com'),
  ).rejects.toThrow('Wait a minute');
});

it('explains email provider restrictions and email sending limits', async () => {
  auth.resend.mockResolvedValue({
    error: { code: 'email_address_not_authorized' },
  });
  await expect(
    authService.resendConfirmation('alex@example.com'),
  ).rejects.toThrow('custom SMTP');
  auth.resend.mockResolvedValue({
    error: { code: 'over_email_send_rate_limit' },
  });
  await expect(
    authService.resendConfirmation('alex@example.com'),
  ).rejects.toThrow('email sending limit');
});
