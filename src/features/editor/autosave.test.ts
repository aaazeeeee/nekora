import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosave } from './autosave';
import type { Draft } from './autosave';
import { ConflictError } from '../../lib/errors';
const initial: Draft = {
  title: 'Initial',
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
};
describe('autosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('debounces edits for 800ms and skips unchanged content', async () => {
    const save = vi.fn().mockResolvedValue(1);
    const notify = vi.fn();
    const controller = new Autosave(initial, 0, save, notify);
    controller.update(initial);
    await vi.advanceTimersByTimeAsync(900);
    expect(save).not.toHaveBeenCalled();
    controller.update({ ...initial, title: 'First' });
    await vi.advanceTimersByTimeAsync(500);
    controller.update({ ...initial, title: 'Latest' });
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledExactlyOnceWith(
      { ...initial, title: 'Latest' },
      0,
    );
    expect(notify).toHaveBeenLastCalledWith({ status: 'saved', message: '' });
    controller.dispose();
  });
  it('serializes requests and uses the returned revision for edits made in flight', async () => {
    let resolveSave: (revision: number) => void = () => {};
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            resolveSave = resolve;
          }),
      )
      .mockResolvedValue(2);
    const controller = new Autosave(initial, 0, save, vi.fn());
    controller.update({ ...initial, title: 'First' });
    await vi.advanceTimersByTimeAsync(800);
    controller.update({ ...initial, title: 'Second' });
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    resolveSave(1);
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenNthCalledWith(2, { ...initial, title: 'Second' }, 1);
    controller.dispose();
  });
  it('preserves the newest draft after a failure and allows explicit retry', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue(1);
    const notify = vi.fn();
    const controller = new Autosave(initial, 0, save, notify);
    controller.update({ ...initial, title: 'Keep me' });
    await vi.advanceTimersByTimeAsync(800);
    expect(notify).toHaveBeenLastCalledWith({
      status: 'error',
      message: 'Offline',
    });
    await controller.flush();
    expect(save).toHaveBeenLastCalledWith({ ...initial, title: 'Keep me' }, 0);
    expect(notify).toHaveBeenLastCalledWith({ status: 'saved', message: '' });
    controller.dispose();
  });
  it('stops saving after a revision conflict, preserving local changes', async () => {
    const save = vi.fn().mockRejectedValue(new ConflictError());
    const notify = vi.fn();
    const controller = new Autosave(initial, 4, save, notify);
    controller.update({ ...initial, title: 'Conflicting' });
    await vi.advanceTimersByTimeAsync(800);
    controller.update({ ...initial, title: 'Still local' });
    await controller.flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(notify.mock.lastCall?.[0].status).toBe('error');
    controller.dispose();
  });
  it('cleans pending timers on disposal', async () => {
    const save = vi.fn();
    const controller = new Autosave(initial, 0, save, vi.fn());
    controller.update({ ...initial, title: 'Changed' });
    controller.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
  });
});
