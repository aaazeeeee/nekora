import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Editor } from '@tiptap/react';
import { errorMessage } from '../../lib/errors';
import { improveWriting } from './writing.service';

export const MAX_IMPROVE_LENGTH = 5000;

export type ImproveTarget = {
  from: number;
  to: number;
  text: string;
  snapshot: string;
};

export type ImproveState =
  | { status: 'closed' }
  | { status: 'prompting'; target: ImproveTarget; error?: string }
  | { status: 'generating'; target: ImproveTarget }
  | {
      status: 'suggested';
      target: ImproveTarget;
      suggestion: string;
      error?: string;
    };

export function isImproveShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j';
}

export function isValidTarget(target: ImproveTarget) {
  return (
    target.text.trim().length > 0 && target.text.length <= MAX_IMPROVE_LENGTH
  );
}

// Uses the selection, or the paragraph at the cursor when nothing is selected.
function captureTarget(editor: Editor): ImproveTarget {
  const {
    from: selectionFrom,
    to: selectionTo,
    empty,
    $from,
  } = editor.state.selection;
  const useParagraph = empty && $from.parent.isTextblock;
  const from = useParagraph ? $from.start() : selectionFrom;
  const to = useParagraph ? $from.end() : selectionTo;
  return {
    from,
    to,
    text: editor.state.doc.textBetween(from, to, '\n'),
    snapshot: JSON.stringify(editor.getJSON()),
  };
}

// JSON text nodes keep model output inert; HTML-like content stays literal text.
function toParagraphs(text: string) {
  return text.split(/\r?\n\s*\r?\n/).map((paragraph) => ({
    type: 'paragraph',
    content: paragraph
      .split(/\r?\n/)
      .flatMap((line, index) => [
        ...(index ? [{ type: 'hardBreak' }] : []),
        ...(line ? [{ type: 'text', text: line }] : []),
      ]),
  }));
}

export function useImproveWriting(editor: Editor | null, documentId: string) {
  const [state, setState] = useState<ImproveState>({ status: 'closed' });
  const [instruction, setInstruction] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const close = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setState({ status: 'closed' });
  }, []);

  const open = useCallback(() => {
    if (!editor?.isEditable) return;
    request.current?.abort();
    setInstruction('');
    setState({ status: 'prompting', target: captureTarget(editor) });
  }, [editor]);

  async function generate(nextInstruction = instruction) {
    if (state.status === 'closed' || state.status === 'generating') return;
    const { target } = state;
    if (!isValidTarget(target)) return;
    const controller = new AbortController();
    request.current = controller;
    setInstruction(nextInstruction);
    setState({ status: 'generating', target });
    try {
      const suggestion = await improveWriting(
        documentId,
        target.text,
        controller.signal,
        nextInstruction.trim(),
      );
      if (!controller.signal.aborted)
        setState({ status: 'suggested', target, suggestion });
    } catch (error) {
      if (!controller.signal.aborted)
        setState({ status: 'prompting', target, error: errorMessage(error) });
    }
  }

  function stop() {
    request.current?.abort();
    request.current = null;
    if (state.status === 'generating')
      setState({ status: 'prompting', target: state.target });
  }

  function editPrompt() {
    if (state.status === 'suggested')
      setState({ status: 'prompting', target: state.target });
  }

  function replace() {
    if (!editor || state.status !== 'suggested') return;
    const { target, suggestion } = state;
    if (
      !editor.isEditable ||
      JSON.stringify(editor.getJSON()) !== target.snapshot
    ) {
      setState({
        ...state,
        error:
          'The document changed since you selected this text. Discard and select it again.',
      });
      return;
    }
    const replaced = editor
      .chain()
      .focus()
      .insertContentAt(
        { from: target.from, to: target.to },
        toParagraphs(suggestion),
      )
      .run();
    if (replaced) close();
    else
      setState({
        ...state,
        error:
          'Could not replace this selection. Select a paragraph and try again.',
      });
  }

  return {
    state,
    instruction,
    setInstruction,
    open,
    close,
    generate,
    stop,
    editPrompt,
    replace,
  };
}

export type ImproveWritingController = ReturnType<typeof useImproveWriting>;
