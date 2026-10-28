import { FunctionsHttpError } from '@supabase/supabase-js';
import { getClient } from '../../lib/supabase/client';
export async function improveWriting(
  documentId: string,
  text: string,
  signal: AbortSignal,
  instruction = '',
): Promise<string> {
  const { data, error } = await getClient().functions.invoke<unknown>(
    'improve-writing',
    { body: { documentId, text, instruction }, signal },
  );
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body: unknown = await error.context.json().catch(() => null);
      if (
        body &&
        typeof body === 'object' &&
        'error' in body &&
        typeof body.error === 'string'
      )
        throw new Error(body.error);
    }
    throw new Error(
      'Could not reach AI writing. Check that the function is deployed and try again.',
    );
  }
  if (
    !data ||
    typeof data !== 'object' ||
    !('text' in data) ||
    typeof data.text !== 'string' ||
    !data.text.trim() ||
    data.text.length > 12000
  )
    throw new Error('AI returned an invalid suggestion. Try again.');
  return data.text;
}
