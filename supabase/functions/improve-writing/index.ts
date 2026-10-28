import { createHandler } from './handler.ts';
Deno.serve(
  createHandler({
    supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
    supabaseKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    geminiKey: Deno.env.get('GEMINI_API_KEY') ?? '',
    model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite',
  }),
);
