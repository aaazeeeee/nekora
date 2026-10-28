// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createHandler } from '../../../supabase/functions/improve-writing/handler';
const settings = {
  supabaseUrl: 'https://test.supabase.co',
  supabaseKey: 'public-key',
  geminiKey: 'server-secret',
  model: 'gemini-3.5-flash-lite',
};
const body = {
  documentId: '11111111-1111-1111-1111-111111111111',
  text: 'Some writing.',
};
function req(input: unknown = body, authenticated = true) {
  return new Request('https://test/improve-writing', {
    method: 'POST',
    headers: authenticated ? { authorization: 'Bearer user-token' } : {},
    body: JSON.stringify(input),
  });
}
describe('AI writing authorization and provider failures', () => {
  it('rejects anonymous and invalid input without contacting providers', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handle = createHandler(settings, fetcher);
    expect((await handle(req(body, false))).status).toBe(401);
    expect(
      (await handle(req({ ...body, text: 'x'.repeat(5001) }))).status,
    ).toBe(400);
    expect((await handle(req({ ...body, text: ' ' }))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['viewer', null])(
    'rejects permission %s before Gemini',
    async (permission) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ id: 'user' }))
        .mockResolvedValueOnce(Response.json(permission));
      expect((await createHandler(settings, fetcher)(req())).status).toBe(403);
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );
  it('rejects expired sessions', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    expect((await createHandler(settings, fetcher)(req())).status).toBe(401);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['owner', 'editor'])(
    'returns suggestions for %s with user-scoped authorization',
    async (permission) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ id: 'user' }))
        .mockResolvedValueOnce(Response.json(permission))
        .mockResolvedValueOnce(
          Response.json({
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: 'Improved writing.' }] },
              },
            ],
          }),
        );
      const response = await createHandler(settings, fetcher)(req());
      expect(await response.json()).toEqual({ text: 'Improved writing.' });
      expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({
        authorization: 'Bearer user-token',
        apikey: 'public-key',
      });
      expect(fetcher.mock.calls[2][1]?.headers).toMatchObject({
        'x-goog-api-key': 'server-secret',
      });
    },
  );
  it.each([429, 500])(
    'handles provider status %s without exposing provider details',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({}))
        .mockResolvedValueOnce(Response.json('owner'))
        .mockResolvedValueOnce(new Response('private details', { status }));
      const response = await createHandler(settings, fetcher)(req());
      expect(response.status).toBe(status === 429 ? 429 : 502);
      expect(await response.text()).not.toContain('private details');
    },
  );
  it('rejects truncated output and missing configuration', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json('editor'))
      .mockResolvedValueOnce(
        Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] }),
      );
    expect((await createHandler(settings, fetcher)(req())).status).toBe(502);
    fetcher
      .mockReset()
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json('owner'));
    expect(
      (await createHandler({ ...settings, geminiKey: '' }, fetcher)(req()))
        .status,
    ).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

it.each([400, 401, 403, 404])(
  'provides actionable configuration guidance for provider status %s',
  async (status) => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({}))
        .mockResolvedValueOnce(Response.json('owner'))
        .mockResolvedValueOnce(
          new Response('sensitive provider response', { status }),
        );
      const response = await createHandler(settings, fetcher)(req());
      expect(response.status).toBe(502);
      const result = await response.json();
      expect(result.error).toContain(
        status === 404 ? 'GEMINI_MODEL' : 'API key',
      );
      expect(JSON.stringify(result)).not.toContain(
        'sensitive provider response',
      );
      expect(logger).toHaveBeenCalledWith('Gemini request failed', {
        status,
        model: settings.model,
      });
    } finally {
      logger.mockRestore();
    }
  },
);

it.each([123, null, 'x'.repeat(1001)])(
  'rejects invalid custom instruction %s',
  async (instruction) => {
    const fetcher = vi.fn<typeof fetch>();
    expect(
      (await createHandler(settings, fetcher)(req({ ...body, instruction })))
        .status,
    ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  },
);

it('sends the editing preference separately from source text', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(Response.json('owner'))
    .mockResolvedValueOnce(
      Response.json({
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: 'Better.' }] } },
        ],
      }),
    );
  const response = await createHandler(
    settings,
    fetcher,
  )(req({ ...body, instruction: ' Be concise. ' }));
  expect(response.status).toBe(200);
  const payload = JSON.parse(String(fetcher.mock.calls[2][1]?.body));
  expect(JSON.parse(payload.contents[0].parts[0].text)).toEqual({
    instruction: 'Be concise.',
    text: body.text,
  });
});
