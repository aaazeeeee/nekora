import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
function validConfiguration(): boolean {
  try {
    const parsed = new URL(url);
    return Boolean(
      key &&
      !url.includes('your-project') &&
      ['http:', 'https:'].includes(parsed.protocol),
    );
  } catch {
    return false;
  }
}
export const isConfigured = validConfiguration();
export const supabase = isConfigured ? createClient<Database>(url, key) : null;
export function getClient() {
  if (!supabase)
    throw new Error(
      'Connect Supabase using the environment variables in .env.example.',
    );
  return supabase;
}
