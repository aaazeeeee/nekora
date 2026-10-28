import type { JSONContent } from '@tiptap/react';
import { ConflictError, errorMessage } from '../../lib/errors';
export type Draft = { title: string; content: JSONContent };
export type SaveState = {
  status: 'saved' | 'pending' | 'saving' | 'error';
  message: string;
  canRetry?: boolean;
};
export class Autosave {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private latest: Draft;
  private persisted: string;
  private running = false;
  private disposed = false;
  private conflict = false;
  constructor(
    initial: Draft,
    private revision: number,
    private save: (draft: Draft, revision: number) => Promise<number>,
    private notify: (state: SaveState) => void,
  ) {
    this.latest = initial;
    this.persisted = JSON.stringify(initial);
  }
  update(draft: Draft) {
    this.latest = draft;
    clearTimeout(this.timer);
    if (this.conflict) return;
    if (JSON.stringify(draft) === this.persisted && !this.running) {
      this.notify({ status: 'saved', message: '' });
      return;
    }
    this.notify({ status: this.running ? 'saving' : 'pending', message: '' });
    this.timer = setTimeout(() => {
      void this.flush();
    }, 800);
  }
  async flush() {
    clearTimeout(this.timer);
    if (this.disposed || this.running || this.conflict) return;
    const snapshot = this.latest;
    const serialized = JSON.stringify(snapshot);
    if (serialized === this.persisted) {
      this.notify({ status: 'saved', message: '' });
      return;
    }
    this.running = true;
    this.notify({ status: 'saving', message: '' });
    try {
      this.revision = await this.save(snapshot, this.revision);
      this.persisted = serialized;
      if (this.disposed) return;
      this.notify({
        status:
          JSON.stringify(this.latest) === serialized ? 'saved' : 'pending',
        message: '',
      });
      if (JSON.stringify(this.latest) !== serialized)
        this.timer = setTimeout(() => {
          void this.flush();
        }, 800);
    } catch (error) {
      this.conflict = error instanceof ConflictError;
      if (!this.disposed)
        this.notify({
          status: 'error',
          message: errorMessage(error),
          ...(this.conflict ? { canRetry: false } : {}),
        });
    } finally {
      this.running = false;
    }
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }
}
