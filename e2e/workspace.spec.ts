import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  createCollaborationServer,
  listenCollaborationServer,
} from '../server/collaboration';
import { createTestStorage } from '../server/test-storage';
import type { Permission } from '../src/types/database';
const testBackends: ReturnType<typeof createTestStorage>[] = [];
const collaborationServers: ReturnType<typeof createCollaborationServer>[] = [];
test.afterEach(async () => {
  for (const backend of testBackends.splice(0)) backend.setFailSaves(false);
  for (const server of collaborationServers.splice(0)) await server.destroy();
});
const id = '10000000-0000-0000-0000-000000000001';
const userId = '00000000-0000-0000-0000-000000000001';
const user = {
  id: userId,
  email: 'alex@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  user_metadata: { display_name: 'Alex Morgan' },
  app_metadata: { provider: 'email' },
  created_at: '2026-01-01T00:00:00Z',
};
async function workspace(page: Page, permission: Permission = 'owner') {
  let document = {
    id,
    owner_id: userId,
    title: 'Product strategy',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'A clear direction.' }],
        },
      ],
    },
    revision: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-10-28T00:00:00Z',
  };
  const backend = createTestStorage();
  testBackends.push(backend);
  backend.roles.set('test-token', permission);
  backend.storage.original = async () => document;
  const store = backend.storage.store;
  backend.storage.store = async (...args) => {
    const version = await store(...args);
    const snapshot = backend.originals.get(id);
    if (snapshot)
      document = {
        ...document,
        ...snapshot,
        content: snapshot.content as typeof document.content,
      };
    return version;
  };
  const server = createCollaborationServer(backend.storage, {
    port: 0,
    origins: [],
  });
  await listenCollaborationServer(server);
  collaborationServers.push(server);
  async function connectPage(target: Page) {
    await target.routeWebSocket('ws://127.0.0.1:1235/**', (route) => {
      const socket = new WebSocket(`ws://127.0.0.1:${server.address.port}`);
      socket.binaryType = 'arraybuffer';
      const pending: (string | Buffer)[] = [];
      route.onMessage((message) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(message);
        else pending.push(message);
      });
      socket.onopen = () => {
        for (const message of pending) socket.send(message);
      };
      socket.onmessage = (event: MessageEvent<string | ArrayBuffer>) =>
        route.send(
          typeof event.data === 'string' ? event.data : Buffer.from(event.data),
        );
      socket.onclose = () => {
        void route.close();
      };
      route.onClose(() => {
        socket.close();
      });
    });
  }
  await connectPage(page);
  let shares: {
    user_id: string;
    display_name: string;
    email: string;
    permission: string;
  }[] = [];
  await page.addInitScript(
    ({ user }) => {
      localStorage.setItem(
        'sb-draftly-test-auth-token',
        JSON.stringify({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_at: 4102444800,
          expires_in: 3600,
          token_type: 'bearer',
          user,
        }),
      );
    },
    { user },
  );
  await page.route('https://draftly-test.supabase.co/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.pathname.split('/').pop();
    const request = route.request().postDataJSON() as Record<
      string,
      unknown
    > | null;
    let response: unknown = null;
    if (url.pathname.includes('/auth/')) response = user;
    else if (action === 'list_documents')
      response = [{ ...document, owner_name: 'Alex Morgan', permission }];
    else if (action === 'documents') response = document;
    else if (action === 'document_access') response = permission;
    else if (action === 'save_document') {
      if (request?.expected_revision !== document.revision) {
        await route.fulfill({
          status: 409,
          json: { code: '40001', message: 'Conflict' },
        });
        return;
      }
      document = {
        ...document,
        title: String(request?.doc_title),
        content: request?.doc_content as typeof document.content,
        revision: document.revision + 1,
      };
      response = document.revision;
    } else if (action === 'create_document') {
      document = {
        ...document,
        title: String(request?.doc_title),
        content: request?.doc_content as typeof document.content,
        revision: 0,
      };
      response = id;
    } else if (action === 'improve-writing')
      response = {
        text: `Improved (${String(request?.instruction) || 'general'}): ${String(request?.text)}`,
      };
    else if (action === 'list_document_shares') response = shares;
    else if (action === 'list_document_access_requests') response = [];
    else if (action === 'share_document') {
      shares = [
        {
          user_id: 'recipient',
          display_name: 'Jamie Chen',
          email: String(request?.recipient_email),
          permission: String(request?.access_level),
        },
      ];
    } else if (action === 'revoke_document_access') shares = [];
    await route.fulfill({ status: 200, json: response });
  });
  return { getDocument: () => document, backend, connectPage };
}
test('opens, edits, autosaves, renames and reopens a document', async ({
  page,
}) => {
  const state = await workspace(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'All documents', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/workspace.png', fullPage: true });
  await page
    .getByRole('row', { name: /Product strategy/ })
    .getByRole('link')
    .click();
  const editor = page.getByRole('textbox', { name: 'Document content' });
  await expect(editor).toContainText('A clear direction.');
  await editor.fill('The next chapter.');
  await page
    .getByLabel('Document title', { exact: true })
    .fill('Updated strategy');
  await expect(page.getByRole('status')).toContainText('All changes saved');
  expect(state.getDocument().title).toBe('Updated strategy');
  expect(JSON.stringify(state.getDocument().content)).toContain(
    'The next chapter.',
  );
  await page.screenshot({ path: 'test-results/editor.png', fullPage: true });
  await page.reload();
  await expect(page.getByLabel('Document title', { exact: true })).toHaveValue(
    'Updated strategy',
  );
  await expect(editor).toContainText('The next chapter.');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Bold', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});
test('owner can grant and revoke access using the sharing dialog', async ({
  page,
}) => {
  await workspace(page);
  await page.goto(`/documents/${id}`);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Email address' })
    .fill('jamie@example.com');
  await page.getByRole('combobox', { name: 'Permission' }).click();
  await page.getByRole('option', { name: /Can view/ }).click();
  await expect(page.getByRole('combobox', { name: 'Permission' })).toHaveText(
    'Can view',
  );
  await page.getByRole('button', { name: 'Give access' }).click();
  const person = page
    .getByRole('listitem')
    .filter({ hasText: 'jamie@example.com' });
  await expect(person).toContainText('Can view');
  await page
    .getByRole('button', { name: 'Revoke access for jamie@example.com' })
    .click();
  await expect(page.getByText('Access revoked.')).toBeVisible();
  await expect(person).toHaveCount(0);
});
test('imports Markdown and opens the persisted document', async ({ page }) => {
  await workspace(page);
  await page.goto('/');
  await page.getByLabel('Import a TXT or Markdown file').setInputFiles({
    name: 'Meeting notes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Meeting notes\n\n**A decision**\n\n- Next step'),
  });
  await expect(page.getByLabel('Document title', { exact: true })).toHaveValue(
    'Meeting notes',
  );
  await expect(
    page
      .getByRole('textbox', { name: 'Document content' })
      .getByRole('heading', { level: 1 }),
  ).toHaveText('Meeting notes');
});
test('viewer sees a read-only editor and no sharing control', async ({
  page,
}) => {
  await workspace(page, 'viewer');
  await page.goto(`/documents/${id}`);
  await expect(
    page.getByRole('textbox', { name: 'Document content' }),
  ).toHaveAttribute('contenteditable', 'false');
  await expect(
    page.getByLabel('Document title', { exact: true }),
  ).toHaveAttribute('readonly', '');
  await expect(
    page.getByRole('button', { name: 'Bold', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Share', exact: true }),
  ).toHaveCount(0);
});
test('mobile workspace fits the viewport and navigation remains usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await workspace(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Shared with me/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Shared with me', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('sign-in screen provides accessible required fields', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Email address' }),
  ).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible();
});
test('save failure preserves the draft, offers recovery and warns before leaving', async ({
  page,
}) => {
  const state = await workspace(page);
  state.backend.setFailSaves(true);
  await page.goto(`/documents/${id}`);
  const editor = page.getByRole('textbox', { name: 'Document content' });
  await editor.fill('Keep this unsaved idea.');
  await expect(page.getByRole('alert')).toContainText('Could not save');
  await expect(editor).toContainText('Keep this unsaved idea.');
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download draft' }).click();
  expect((await download).suggestedFilename()).toBe(
    'nekora-unsaved-draft.json',
  );
  await page.getByRole('link', { name: 'Back to documents' }).click();
  await expect(
    page.getByRole('dialog', { name: 'You have unsaved changes' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(editor).toContainText('Keep this unsaved idea.');
});

test('highlighting text offers an inline improve prompt', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await workspace(page);
  await page.goto(`/documents/${id}`);
  const editor = page.getByRole('textbox', { name: 'Document content' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.getByRole('button', { name: 'Improve selection' }).click();
  const panel = page.getByRole('region', { name: 'Improve writing' });
  await expect(panel).toContainText('A clear direction.');
  await panel.getByLabel('How should it be improved?').fill('make it bolder');
  await panel.getByRole('button', { name: 'Generate suggestion' }).click();
  await expect(panel).toContainText(
    'Improved (make it bolder): A clear direction.',
  );
  await panel.getByRole('button', { name: 'Replace selection' }).click();
  await expect(panel).toHaveCount(0);
  await expect(editor).toHaveText(
    'Improved (make it bolder): A clear direction.',
  );
  await expect(page.getByRole('status')).toContainText('All changes saved');
  expect(errors).toEqual([]);
});

test('two browser pages synchronize edits, titles, presence and undo', async ({
  page,
  context,
}) => {
  const state = await workspace(page);
  const second = await context.newPage();
  await state.connectPage(second);
  // Both pages share the browser's authenticated session and HTTP route mocks.
  await second.route('https://draftly-test.supabase.co/**', async (route) => {
    const action = new URL(route.request().url()).pathname.split('/').pop();
    const response =
      action === 'documents'
        ? state.getDocument()
        : action === 'document_access'
          ? 'owner'
          : action === 'list_documents'
            ? [
                {
                  ...state.getDocument(),
                  owner_name: 'Alex Morgan',
                  permission: 'owner',
                },
              ]
            : user;
    await route.fulfill({ json: response });
  });
  await page.goto(`/documents/${id}`);
  const firstEditor = page.getByRole('textbox', { name: 'Document content' });
  await expect(firstEditor).toBeVisible();
  await second.goto(`/documents/${id}`);
  const secondEditor = second.getByRole('textbox', {
    name: 'Document content',
  });
  await expect(secondEditor).toContainText('A clear direction.');
  await firstEditor.fill('A shared idea.');
  await expect(secondEditor).toContainText('A shared idea.');
  await second
    .getByLabel('Document title', { exact: true })
    .fill('A shared title');
  await expect(page.getByLabel('Document title', { exact: true })).toHaveValue(
    'A shared title',
  );
  await expect(second.getByRole('status')).toContainText('All changes saved');
  await secondEditor.click();
  await second.keyboard.press('End');
  await second.keyboard.type(' From Jamie.');
  await expect(firstEditor).toContainText('From Jamie.');
  await second.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(firstEditor).not.toContainText('From Jamie.');
  await expect(firstEditor).toContainText('A shared idea.');
});
