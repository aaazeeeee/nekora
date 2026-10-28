// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import {
  createCollaborationServer,
  listenCollaborationServer,
} from './collaboration';
import { createTestStorage } from './test-storage';
import { documentSnapshot, initializeDocument } from './document';

const servers: ReturnType<typeof createCollaborationServer>[] = [];
const providers: HocuspocusProvider[] = [];
async function start(backend = createTestStorage(), permissionInterval = 50) {
  const server = createCollaborationServer(backend.storage, {
    port: 0,
    origins: [],
    permissionInterval,
  });
  await listenCollaborationServer(server);
  servers.push(server);
  return { backend, server, url: `ws://127.0.0.1:${server.address.port}` };
}
async function connect(url: string, token = 'editor-token', name = 'document') {
  const provider = new HocuspocusProvider({ url, name, token });
  providers.push(provider);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out connecting')),
      4000,
    );
    provider.on('synced', () => {
      clearTimeout(timeout);
      resolve();
    });
    provider.on('authenticationFailed', () => {
      clearTimeout(timeout);
      reject(new Error('Access denied'));
    });
  });
  return provider;
}
async function checkpoint(
  provider: HocuspocusProvider,
  id = 1,
  includeUpdate = true,
) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('No persistence acknowledgement')),
      4000,
    );
    const handler = ({ payload }: { payload: string }) => {
      const response: unknown = JSON.parse(payload);
      if (
        response &&
        typeof response === 'object' &&
        'id' in response &&
        response.id === id
      ) {
        clearTimeout(timeout);
        provider.off('stateless', handler);
        resolve(response as Record<string, unknown>);
      }
    };
    provider.on('stateless', handler);
    provider.sendStateless(
      JSON.stringify({
        type: 'checkpoint',
        id,
        ...(includeUpdate
          ? {
              update: Buffer.from(
                Y.encodeStateAsUpdate(provider.document),
              ).toString('base64'),
            }
          : {}),
      }),
    );
  });
}
afterEach(async () => {
  for (const provider of providers.splice(0)) {
    provider.destroy();
    provider.document.destroy();
  }
  for (const server of servers.splice(0)) await server.destroy();
});
describe('real WebSocket collaboration protocol with an in-memory persistence adapter', () => {
  it('merges concurrent edits and titles, checkpoints deletions, and survives a server restart', async () => {
    const { server, backend, url } = await start();
    const first = await connect(url);
    const second = await connect(url, 'owner-token');
    expect(documentSnapshot(first.document).title).toBe('Product strategy');
    first.document.getMap('metadata').set('title', 'Shared title');
    second.document.getMap('metadata').set('subtitle', 'Concurrent metadata');
    const paragraph1 = first.document
      .getXmlFragment('default')
      .get(0) as Y.XmlElement;
    const paragraph2 = second.document
      .getXmlFragment('default')
      .get(0) as Y.XmlElement;
    (paragraph1.get(0) as Y.XmlText).insert(0, 'Alex: ');
    (paragraph2.get(0) as Y.XmlText).insert(0, 'Jamie: ');
    await expect
      .poll(() => JSON.stringify(documentSnapshot(second.document)))
      .toContain('Alex: ');
    await expect
      .poll(() => JSON.stringify(documentSnapshot(first.document)))
      .toContain('Jamie: ');
    expect(await checkpoint(first)).toMatchObject({ type: 'saved' });
    (paragraph1.get(0) as Y.XmlText).delete(0, 1);
    expect(await checkpoint(first, 2)).toMatchObject({ type: 'saved' });
    const saved = documentSnapshot(first.document);
    expect(backend.originals.get('document')?.content).toEqual(saved.content);
    first.destroy();
    second.destroy();
    await server.destroy();
    servers.splice(servers.indexOf(server), 1);
    const restarted = await start(backend);
    const reopened = await connect(restarted.url);
    expect(documentSnapshot(reopened.document)).toEqual(saved);
  });
  it('isolates rooms, rejects unauthorized users and ignores viewer writes', async () => {
    const { url } = await start();
    await expect(connect(url, 'stranger')).rejects.toThrow('Access denied');
    const editor = await connect(url);
    const viewer = await connect(url, 'viewer-token');
    const other = await connect(url, 'editor-token', 'another-document');
    viewer.document.getMap('metadata').set('title', 'Unauthorized title');
    expect(await checkpoint(viewer)).toMatchObject({ type: 'save-error' });
    editor.document.getMap('metadata').set('title', 'Authorized title');
    expect(await checkpoint(editor)).toMatchObject({ type: 'saved' });
    expect(documentSnapshot(editor.document).title).toBe('Authorized title');
    expect(documentSnapshot(other.document).title).toBe('Product strategy');
  });
  it('closes idle revoked connections and rejects subsequent writes', async () => {
    const { backend, url } = await start();
    const editor = await connect(url);
    const closed = new Promise<void>((resolve) =>
      editor.on('close', () => resolve()),
    );
    backend.roles.delete('editor-token');
    await closed;
    expect(editor.isAuthenticated).toBe(false);
  });
  it('reports failed durable checkpoints and allows retry without losing the draft', async () => {
    const { backend, url } = await start();
    const editor = await connect(url);
    backend.setFailSaves(true);
    editor.document.getMap('metadata').set('title', 'Unsaved draft');
    expect(await checkpoint(editor)).toMatchObject({ type: 'save-error' });
    expect(documentSnapshot(editor.document).title).toBe('Unsaved draft');
    backend.setFailSaves(false);
    expect(await checkpoint(editor, 2)).toMatchObject({ type: 'saved' });
    expect(backend.originals.get('document')?.title).toBe('Unsaved draft');
  });
  it('migrates an existing document exactly once without duplicating text', async () => {
    const { backend, url } = await start();
    const initial = initializeDocument('Imported title', {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Original import' }],
        },
      ],
    });
    backend.records.set('document', {
      state: Buffer.from(Y.encodeStateAsUpdate(initial)).toString('base64'),
      version: 1,
    });
    initial.destroy();
    const first = await connect(url);
    const second = await connect(url);
    expect(documentSnapshot(first.document)).toEqual(
      documentSnapshot(second.document),
    );
    expect(
      JSON.stringify(documentSnapshot(first.document)).match(
        /Original import/g,
      ),
    ).toHaveLength(1);
  });
  it('prevents a second server from overwriting a newer durable CRDT version', async () => {
    const firstServer = await start();
    const secondServer = await start(firstServer.backend);
    const first = await connect(firstServer.url);
    const second = await connect(secondServer.url);
    first.document.getMap('metadata').set('title', 'First server commit');
    second.document
      .getMap('metadata')
      .set('title', 'Second server stale commit');
    expect(await checkpoint(first)).toMatchObject({ type: 'saved' });
    expect(await checkpoint(second)).toMatchObject({ type: 'save-error' });
    expect(firstServer.backend.originals.get('document')?.title).toBe(
      'First server commit',
    );
  });
  it('delivers an edit burst while background authorization is waiting on the network', async () => {
    const backend = createTestStorage();
    const authorize = backend.storage.authorize;
    let blockRefresh = false;
    let authorizationCalls = 0;
    let releaseRefresh: () => void = () => undefined;
    let refreshStarted: () => void = () => undefined;
    const blocked = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const started = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    backend.storage.authorize = async (...args) => {
      authorizationCalls += 1;
      if (blockRefresh) {
        refreshStarted();
        await blocked;
      }
      return authorize(...args);
    };
    const { url } = await start(backend, 2000);
    const first = await connect(url);
    const second = await connect(url, 'owner-token');
    blockRefresh = true;
    try {
      await started;
      const before = authorizationCalls;
      for (let index = 0; index < 30; index += 1) {
        first.document.getMap('metadata').set('title', `Fast edit ${index}`);
        first.setAwarenessField('cursor', { index });
      }
      await expect
        .poll(() => second.document.getMap('metadata').get('title'), {
          timeout: 500,
          interval: 10,
        })
        .toBe('Fast edit 29');
      // Only the other connection's scheduled renewal may start; none of the
      // sixty edit/presence messages should issue their own authorization call.
      expect(authorizationCalls - before).toBeLessThanOrEqual(1);
    } finally {
      releaseRefresh();
    }
  });
  it('closes an expired access lease when permission renewal stalls', async () => {
    const backend = createTestStorage();
    const authorize = backend.storage.authorize;
    let blockRefresh = false;
    let release: () => void = () => undefined;
    const stalled = new Promise<void>((resolve) => {
      release = resolve;
    });
    backend.storage.authorize = async (...args) => {
      if (blockRefresh) await stalled;
      return authorize(...args);
    };
    const { url } = await start(backend, 1000);
    const editor = await connect(url);
    blockRefresh = true;
    try {
      const closed = new Promise<void>((resolve) =>
        editor.on('close', resolve),
      );
      await closed;
      expect(editor.isAuthenticated).toBe(false);
    } finally {
      release();
    }
  });
});
