import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { Editor } from '@tiptap/core';
import type { Editor as ReactEditor } from '@tiptap/react';
import { afterEach, expect, it, vi } from 'vitest';
import { editorExtensions } from '../editor/config';
import { ImproveWritingButton, ImproveWritingLayer } from './ImproveWriting';
import { useImproveWriting } from './useImproveWriting';
import { improveWriting } from './writing.service';
vi.mock('./writing.service', () => ({ improveWriting: vi.fn() }));
let editor: Editor;
afterEach(() => {
  cleanup();
  editor?.destroy();
  vi.mocked(improveWriting).mockReset();
});
function Harness({ editor }: { editor: ReactEditor }) {
  const improve = useImproveWriting(editor, 'document');
  return (
    <>
      <ImproveWritingButton improve={improve} />
      <ImproveWritingLayer editor={editor} improve={improve} />
    </>
  );
}
function mount(content: string) {
  editor = new Editor({ extensions: editorExtensions, content });
  render(<Harness editor={editor as ReactEditor} />);
}
async function preview() {
  mount('<p>Original writing.</p>');
  editor.commands.setTextSelection({ from: 1, to: 18 });
  vi.mocked(improveWriting).mockResolvedValue('Improved writing.');
  fireEvent.click(screen.getByRole('button', { name: 'Improve writing' }));
  fireEvent.click(screen.getByRole('button', { name: 'Generate suggestion' }));
  await screen.findByText('Improved writing.');
}
it('previews before replacing and supports undo', async () => {
  await preview();
  expect(editor.getText()).toBe('Original writing.');
  fireEvent.click(screen.getByRole('button', { name: 'Replace selection' }));
  expect(editor.getText()).toBe('Improved writing.');
  expect(screen.queryByRole('region', { name: 'Improve writing' })).toBeNull();
  act(() => {
    editor.commands.undo();
  });
  expect(editor.getText()).toBe('Original writing.');
});
it('preserves changes made after capturing the selection', async () => {
  await preview();
  act(() => {
    editor.commands.insertContent('New edit');
  });
  const current = editor.getText();
  fireEvent.click(screen.getByRole('button', { name: 'Replace selection' }));
  expect(screen.getByRole('alert')).toHaveTextContent('document changed');
  expect(editor.getText()).toBe(current);
});
it('improves the current paragraph without a text selection', async () => {
  mount('<p>First paragraph.</p><p>Second paragraph.</p>');
  editor.commands.setTextSelection(20);
  vi.mocked(improveWriting).mockResolvedValue('Better second paragraph.');
  fireEvent.click(screen.getByRole('button', { name: 'Improve writing' }));
  expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Generate suggestion' }));
  await screen.findByText('Better second paragraph.');
  expect(improveWriting).toHaveBeenLastCalledWith(
    'document',
    'Second paragraph.',
    expect.any(AbortSignal),
    '',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Replace selection' }));
  expect(editor.getText()).toBe('First paragraph.\n\nBetter second paragraph.');
});
it('explains how to proceed in an empty paragraph', () => {
  mount('');
  fireEvent.click(screen.getByRole('button', { name: 'Improve writing' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Select some text');
  expect(
    screen.getByRole('button', { name: 'Generate suggestion' }),
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Fix grammar' })).toBeDisabled();
});
it('sends quick prompts and edited instructions for the original text', async () => {
  await preview();
  fireEvent.click(screen.getByRole('button', { name: 'Edit prompt' }));
  vi.mocked(improveWriting).mockResolvedValueOnce('Shorter writing.');
  fireEvent.click(screen.getByRole('button', { name: 'Make it shorter' }));
  await screen.findByText('Shorter writing.');
  expect(improveWriting).toHaveBeenLastCalledWith(
    'document',
    'Original writing.',
    expect.any(AbortSignal),
    'Make it shorter',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit prompt' }));
  const instruction = screen.getByLabelText('How should it be improved?');
  expect(instruction).toHaveValue('Make it shorter');
  fireEvent.change(instruction, { target: { value: 'Sound warmer.' } });
  vi.mocked(improveWriting).mockResolvedValueOnce('Warmer writing.');
  fireEvent.keyDown(instruction, { key: 'Enter' });
  await screen.findByText('Warmer writing.');
  expect(improveWriting).toHaveBeenLastCalledWith(
    'document',
    'Original writing.',
    expect.any(AbortSignal),
    'Sound warmer.',
  );
  expect(editor.getText()).toBe('Original writing.');
});
it('can stop a request and close with Escape', () => {
  mount('<p>Original writing.</p>');
  editor.commands.setTextSelection({ from: 1, to: 18 });
  vi.mocked(improveWriting).mockReturnValue(new Promise(() => {}));
  fireEvent.click(screen.getByRole('button', { name: 'Improve writing' }));
  fireEvent.click(screen.getByRole('button', { name: 'Generate suggestion' }));
  expect(screen.getByRole('status')).toHaveTextContent('Generating');
  const signal = vi.mocked(improveWriting).mock.calls[0]?.[2];
  fireEvent.click(screen.getByRole('button', { name: 'Stop generating' }));
  expect(signal?.aborted).toBe(true);
  const panel = screen.getByRole('region', { name: 'Improve writing' });
  fireEvent.keyDown(panel, { key: 'Escape' });
  expect(screen.queryByRole('region', { name: 'Improve writing' })).toBeNull();
});

it('closes from the close button without changing the document', async () => {
  await preview();
  fireEvent.click(
    screen.getByRole('button', { name: 'Close improve writing' }),
  );
  expect(screen.queryByRole('region', { name: 'Improve writing' })).toBeNull();
  expect(editor.getText()).toBe('Original writing.');
});
