import { Server } from '@hocuspocus/server';
import type { Connection, Document } from '@hocuspocus/server';
import * as decoding from 'lib0/decoding';
import * as Y from 'yjs';
import { CollaborationConflictError } from './collaboration.service';
import type { CollaborationStorage } from './collaboration.service';
import type { Permission } from '../src/types/database';
import {
  documentSnapshot,
  initializeDocument,
  MAX_STATE_BYTES,
  validateUpdate,
} from './document';

type AccessLease = {
  token: string;
  validUntil: number;
  refresh?: Promise<Permission>;
};
type Room = {
  version: number;
  state: string;
  queue: Promise<void>;
  conflict: boolean;
  retryTimer?: ReturnType<typeof setTimeout>;
};
export function createCollaborationServer(
  storage: CollaborationStorage,
  options: {
    port: number;
    address?: string;
    origins: string[];
    permissionInterval?: number;
  },
) {
  const rooms = new WeakMap<Y.Doc, Room>();
  const leases = new WeakMap<Connection, AccessLease>();
  const leaseDuration = options.permissionInterval ?? 5000;
  const permissionTimers = new Map<string, ReturnType<typeof setInterval>>();
  const authQueues = new WeakMap<Connection, Promise<void>>();

  function refreshAccess(connection: Connection, lease: AccessLease) {
    if (lease.refresh) return lease.refresh;
    const startedAt = Date.now();
    lease.refresh = storage
      .authorize(lease.token, connection.document.name)
      .then((permission) => {
        if (connection.readOnly !== (permission === 'viewer')) {
          throw new Error('Permissions changed. Reopen this document.');
        }
        // Bound staleness from the start of verification, including network time.
        lease.validUntil = startedAt + leaseDuration;
        return permission;
      })
      .catch((error: unknown) => {
        lease.validUntil = 0;
        if (leases.get(connection) === lease) {
          connection.close({
            code: 4403,
            reason: 'Access expired or was revoked. Reopen the document.',
          });
        }
        throw error;
      })
      .finally(() => {
        lease.refresh = undefined;
      });
    return lease.refresh;
  }
  async function check(connection: Connection) {
    if (!connection.document.hasConnection(connection))
      throw new Error('Connection is closed.');
    const lease = leases.get(connection);
    if (!lease) throw new Error('Sign in again to continue.');
    // Keystrokes and cursor updates use a short verified lease. Renewal happens
    // in the background; only an expired lease waits for remote authorization.
    if (Date.now() < lease.validUntil) return;
    await refreshAccess(connection, lease);
    if (
      !connection.document.hasConnection(connection) ||
      Date.now() >= lease.validUntil
    )
      throw new Error('Authorization timed out. Reconnect to continue.');
  }
  async function persist(document: Document) {
    const room = rooms.get(document);
    if (!room || room.conflict)
      throw new Error(
        'Reopen this document to reconnect to its collaboration server.',
      );
    const operation = room.queue.then(async () => {
      const state = Buffer.from(Y.encodeStateAsUpdate(document)).toString(
        'base64',
      );
      if (state === room.state) return;
      const snapshot = documentSnapshot(document);
      try {
        room.version = await storage.store(
          document.name,
          room.version,
          state,
          snapshot.title,
          snapshot.content,
        );
        room.state = state;
      } catch (error) {
        if (error instanceof CollaborationConflictError) {
          room.conflict = true;
          for (const connection of document.getConnections()) {
            connection.sendStateless(
              JSON.stringify({ type: 'fatal', message: error.message }),
            );
          }
        }
        throw error;
      }
    });
    // Keep the queue usable after transient persistence errors.
    room.queue = operation.catch(() => undefined);
    await operation;
  }
  function scheduleRetry(document: Document) {
    const room = rooms.get(document);
    if (!room || room.conflict || room.retryTimer) return;
    room.retryTimer = setTimeout(() => {
      room.retryTimer = undefined;
      void persist(document)
        .then(() => {
          if (document.getConnectionsCount() === 0)
            return server.hocuspocus.unloadDocument(document);
        })
        .catch(() => scheduleRetry(document));
    }, 3000);
    room.retryTimer.unref();
  }
  const server = new Server(
    {
      port: options.port,
      address: options.address ?? '127.0.0.1',
      quiet: true,
      stopOnSignals: false,
      debounce: 800,
      maxDebounce: 3000,
      async onConnect({ requestHeaders }) {
        const origin = requestHeaders.origin;
        if (origin && !options.origins.includes(origin))
          throw new Error('Origin is not allowed.');
      },
      async onAuthenticate({ token, documentName, connectionConfig }) {
        const startedAt = Date.now();
        const permission = await storage.authorize(token, documentName);
        connectionConfig.readOnly = permission === 'viewer';
        return { token, validUntil: startedAt + leaseDuration };
      },
      async connected({ connection, context }) {
        const auth: unknown = context;
        if (
          !auth ||
          typeof auth !== 'object' ||
          !('token' in auth) ||
          typeof auth.token !== 'string' ||
          !('validUntil' in auth) ||
          typeof auth.validUntil !== 'number'
        )
          throw new Error('Authentication required.');
        const lease: AccessLease = {
          token: auth.token,
          validUntil: auth.validUntil,
        };
        leases.set(connection, lease);
        const timer = setInterval(
          () => {
            const current = leases.get(connection);
            if (current) {
              if (Date.now() >= current.validUntil) {
                connection.close({
                  code: 4403,
                  reason: 'Authorization expired. Reconnect to continue.',
                });
                return;
              }
              // refreshAccess closes the connection on failure. Catch the rejection
              // here because this background timer has no request to report it to.
              void refreshAccess(connection, current).catch(() => undefined);
            }
          },
          Math.max(10, leaseDuration / 2),
        );
        timer.unref();
        permissionTimers.set(
          `${connection.socketId}:${connection.document.name}`,
          timer,
        );
      },
      async onTokenSync({ token, connection }) {
        const lease: AccessLease = { token, validUntil: 0 };
        await refreshAccess(connection, lease);
        leases.set(connection, lease);
      },
      async onLoadDocument({ document, documentName }) {
        let stored = await storage.load(documentName);
        if (!stored) {
          const original = await storage.original(documentName);
          const initial = initializeDocument(original.title, original.content);
          try {
            stored = await storage.initialize(
              documentName,
              original.revision,
              Buffer.from(Y.encodeStateAsUpdate(initial)).toString('base64'),
            );
          } finally {
            initial.destroy();
          }
        }
        Y.applyUpdate(document, Buffer.from(stored.state, 'base64'));
        documentSnapshot(document);
        rooms.set(document, {
          ...stored,
          queue: Promise.resolve(),
          conflict: false,
        });
      },
      async beforeHandleMessage({ connection, update }) {
        // Preserve message order; valid access leases keep remote I/O off this path.
        const previous = authQueues.get(connection) ?? Promise.resolve();
        const next = previous.then(async () => {
          await check(connection);
          if (rooms.get(connection.document)?.conflict)
            throw new Error('Reopen this document.');
          const decoder = decoding.createDecoder(update);
          decoding.readVarString(decoder);
          const type = decoding.readVarUint(decoder);
          // Client broadcasts could spoof server persistence acknowledgements.
          if (type === 6) throw new Error('Client broadcasts are disabled.');
          if (type === 0 || type === 4) {
            const syncType = decoding.readVarUint(decoder);
            if (!connection.readOnly && (syncType === 1 || syncType === 2)) {
              validateUpdate(
                connection.document,
                decoding.readVarUint8Array(decoder),
              );
            }
          }
        });
        authQueues.set(
          connection,
          next.catch(() => undefined),
        );
        await next;
      },
      async onStateless({ connection, document, payload }) {
        // Explicit checkpoints acknowledge durable storage, including deletions.
        // The update also prevents async auth/network ordering from acknowledging
        // a checkpoint before its preceding edit has reached the server.
        let requestId: unknown;
        try {
          if (payload.length > 8 * 1024 * 1024)
            throw new Error('Checkpoint is too large.');
          const request: unknown = JSON.parse(payload);
          if (
            !request ||
            typeof request !== 'object' ||
            !('type' in request) ||
            request.type !== 'checkpoint' ||
            !('id' in request) ||
            typeof request.id !== 'number' ||
            !Number.isSafeInteger(request.id)
          )
            return;
          requestId = request.id;
          await check(connection);
          if ('update' in request) {
            if (connection.readOnly)
              throw new Error('This document is read-only.');
            if (typeof request.update !== 'string')
              throw new Error('Invalid checkpoint.');
            const update = Buffer.from(request.update, 'base64');
            validateUpdate(document, update);
            Y.applyUpdate(document, update, connection);
          }
          await persist(document);
          connection.sendStateless(
            JSON.stringify({
              type: 'saved',
              id: requestId,
              vector: Buffer.from(Y.encodeStateVector(document)).toString(
                'base64',
              ),
            }),
          );
        } catch (error) {
          connection.sendStateless(
            JSON.stringify({
              type: 'save-error',
              id: requestId,
              message:
                error instanceof CollaborationConflictError
                  ? error.message
                  : 'Could not save. Keep this tab open and retry, or download your draft.',
            }),
          );
        }
      },
      async onStoreDocument({ document }) {
        try {
          await persist(document);
        } catch {
          // Hocuspocus 3 does not catch background store rejections. Keep the
          // room in memory and retry instead of crashing or unloading its draft.
          console.error(
            'Collaboration persistence failed; retaining the room and retrying.',
          );
          scheduleRetry(document);
        }
      },
      async beforeUnloadDocument({ document }) {
        const room = rooms.get(document);
        if (
          room &&
          !room.conflict &&
          Buffer.from(Y.encodeStateAsUpdate(document)).toString('base64') !==
            room.state
        ) {
          scheduleRetry(document);
          throw new Error('Unsaved collaboration state is retained for retry.');
        }
        clearTimeout(room?.retryTimer);
      },
      async onDisconnect({ socketId, documentName }) {
        const key = `${socketId}:${documentName}`;
        clearInterval(permissionTimers.get(key));
        permissionTimers.delete(key);
      },
      async onDestroy() {
        for (const timer of permissionTimers.values()) clearInterval(timer);
        permissionTimers.clear();
      },
    },
    { maxPayload: MAX_STATE_BYTES + 2 * 1024 * 1024 },
  );
  return server;
}

/** Hocuspocus 3 passes `address` instead of Node's `host`; bind explicitly. */
export async function listenCollaborationServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    const failed = (error: Error) => {
      reject(error);
    };
    server.httpServer.once('error', failed);
    server.httpServer.listen(
      { port: server.configuration.port, host: server.configuration.address },
      () => {
        server.httpServer.off('error', failed);
        resolve();
      },
    );
  });
}
