import { getClient } from '../../lib/supabase/client';
function emailDeliveryError(
  error: { code?: string; status?: number },
  fallback: string,
) {
  if (error.code === 'over_email_send_rate_limit')
    return new Error(
      'The email sending limit has been reached. Please try again later.',
    );
  if (error.code === 'over_request_rate_limit' || error.status === 429)
    return new Error(
      'Too many requests. Wait a minute before requesting another code.',
    );
  if (error.code === 'email_address_not_authorized')
    return new Error(
      'Email delivery is not configured for this address. The workspace administrator must configure a custom SMTP provider in Supabase.',
    );
  if (error.code === 'unexpected_failure')
    return new Error(
      'The email service could not complete signup. Please contact the workspace administrator.',
    );
  return new Error(fallback);
}
export const authService = {
  async signIn(email: string, password: string) {
    const { error } = await getClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      throw new Error(
        'Could not sign in. Check your email and password, then try again.',
      );
  },
  async signUp(email: string, password: string, displayName: string) {
    if (password.length < 10)
      throw new Error('Use a password with at least 10 characters.');
    const { data, error } = await getClient().auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim().slice(0, 100) },
      },
    });
    if (error)
      throw emailDeliveryError(
        error,
        'Could not create your account. Please try again.',
      );
    return Boolean(data.session);
  },
  async confirmEmail(email: string, code: string) {
    const token = code.trim();
    if (!/^[0-9]{6,10}$/.test(token))
      throw new Error('Enter the numeric confirmation code from your email.');
    const { error } = await getClient().auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
    if (error)
      throw new Error(
        'That code is invalid or expired. Try again or request a new code.',
      );
  },
  async resendConfirmation(email: string) {
    const { error } = await getClient().auth.resend({ type: 'signup', email });
    if (error)
      throw emailDeliveryError(
        error,
        'Could not resend the code. Wait a minute, then try again.',
      );
  },
  async signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) throw new Error('Could not sign out. Please try again.');
  },
};
