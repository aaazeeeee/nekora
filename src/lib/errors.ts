export class ConflictError extends Error {
  constructor() {
    super(
      'This document changed in another session. Your draft is preserved. Copy your changes, then reload to continue.',
    );
  }
}
// Authorization failures, so screens can offer "Request access" only when it applies.
export class AccessDeniedError extends Error {
  constructor(
    message = 'This document is unavailable or you do not have permission.',
  ) {
    super(message);
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
export function databaseError(error: {
  code?: string;
  message: string;
}): Error {
  if (error.code === '55000')
    return new Error(
      'Open this document in the collaborative editor to continue saving. Your draft is preserved.',
    );
  if (error.code === '40001') return new ConflictError();
  if (error.code === '42501' || error.code === 'PGRST116')
    return new AccessDeniedError();
  if (error.code === 'P0002')
    return new Error(
      'No account found with that email. Ask them to sign up first.',
    );
  if (error.code === '22023') return new Error('The owner already has access.');
  if (error.code === '23514')
    return new Error(
      'Check the title (1–200 characters) and document size (up to 2 MB).',
    );
  return new Error(
    'Could not reach your workspace. Check your connection and try again.',
  );
}
