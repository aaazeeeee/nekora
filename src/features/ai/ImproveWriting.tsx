import { useEffect, useLayoutEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  ArrowUp,
  PencilLine,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  MAX_IMPROVE_LENGTH,
  isValidTarget,
  type ImproveWritingController,
} from './useImproveWriting';

const QUICK_PROMPTS = [
  'Fix grammar',
  'Make it clearer',
  'Make it shorter',
  'More professional',
];

// Module-level so BubbleMenu doesn't re-register its plugin on every render.
const TARGET_HIGHLIGHT = new PluginKey('improve-writing-target');

// Keeps the text being improved visibly highlighted while focus is in the panel.
function useTargetHighlight(editor: Editor, from: number, to: number) {
  useEffect(() => {
    if (from === to) return;
    editor.registerPlugin(
      new Plugin({
        key: TARGET_HIGHLIGHT,
        props: {
          decorations: (state) => {
            const end = Math.min(to, state.doc.content.size);
            return from < end
              ? DecorationSet.create(state.doc, [
                  Decoration.inline(from, end, { class: 'ai-target' }),
                ])
              : DecorationSet.empty;
          },
        },
      }),
    );
    return () => {
      if (!editor.isDestroyed) editor.unregisterPlugin(TARGET_HIGHLIGHT);
    };
  }, [editor, from, to]);
}

const BUBBLE_OPTIONS = { placement: 'top', offset: 8 } as const;
type ShouldShow = NonNullable<ComponentProps<typeof BubbleMenu>['shouldShow']>;
const showForSelection: ShouldShow = ({ editor, view, element, from, to }) =>
  editor.isEditable &&
  (view.hasFocus() || element.contains(document.activeElement)) &&
  editor.state.doc.textBetween(from, to).trim().length > 0;

export function ImproveWritingButton({
  improve,
}: {
  improve: ImproveWritingController;
}) {
  return (
    <Button
      variant="ghost"
      className="improve-button"
      onClick={improve.open}
      title="Improve the selection or the paragraph at your cursor (⌘J)"
    >
      <Sparkles size={15} />
      Improve writing
    </Button>
  );
}

export function ImproveWritingLayer({
  editor,
  improve,
}: {
  editor: Editor;
  improve: ImproveWritingController;
}) {
  return (
    <>
      {improve.state.status === 'closed' && (
        <BubbleMenu
          editor={editor}
          options={BUBBLE_OPTIONS}
          shouldShow={showForSelection}
        >
          <button
            type="button"
            className="ai-sparkle"
            aria-label="Improve selection"
            title="Improve selection (⌘J)"
            // Keep the editor selection while clicking.
            onMouseDown={(event) => event.preventDefault()}
            onClick={improve.open}
          >
            <Sparkles size={15} />
            Improve
          </button>
        </BubbleMenu>
      )}
      {improve.state.status !== 'closed' && (
        <ImprovePanel editor={editor} improve={improve} />
      )}
    </>
  );
}

function ImprovePanel({
  editor,
  improve,
}: {
  editor: Editor;
  improve: ImproveWritingController;
}) {
  const { state, instruction, setInstruction } = improve;
  const [top, setTop] = useState<number | null>(null);
  const targetStart = state.status === 'closed' ? 0 : state.target.from;
  const targetEnd = state.status === 'closed' ? 0 : state.target.to;
  useTargetHighlight(editor, targetStart, targetEnd);
  // Anchor the panel just below the text being improved.
  useLayoutEffect(() => {
    function place() {
      const layer = editor.view.dom.closest('.editor-page');
      if (!layer) return;
      const position = Math.min(targetEnd, editor.state.doc.content.size);
      const bottom = editor.view.coordsAtPos(position).bottom;
      setTop(bottom - layer.getBoundingClientRect().top + 10);
    }
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [editor, targetEnd]);
  if (state.status === 'closed') return null;
  const { target } = state;
  const valid = isValidTarget(target);
  const generating = state.status === 'generating';
  function dismiss() {
    improve.close();
    editor.commands.focus();
  }
  return (
    <section
      className="ai-panel"
      aria-label="Improve writing"
      style={{ top: top ?? undefined }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          dismiss();
        }
      }}
    >
      <div className={`ai-card ${generating ? 'generating' : ''}`}>
        {state.status === 'suggested' ? (
          <>
            <p className="ai-label">
              <Sparkles size={13} />
              Suggestion
            </p>
            <p className="ai-suggestion">{state.suggestion}</p>
          </>
        ) : (
          <>
            <p className={`ai-quote ${generating ? 'shimmer' : ''}`}>
              {target.text || 'Nothing selected'}
            </p>
            {generating ? (
              <p className="ai-generating" role="status">
                Generating…
              </p>
            ) : (
              <>
                <label className="sr-only" htmlFor="writing-instruction">
                  How should it be improved?
                </label>
                <textarea
                  id="writing-instruction"
                  className="ai-instruction"
                  rows={2}
                  maxLength={1000}
                  autoFocus
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && valid) {
                      event.preventDefault();
                      void improve.generate();
                    }
                  }}
                  placeholder="How should it be improved? (optional)"
                />
              </>
            )}
          </>
        )}
        {!valid && (
          <p role="alert" className="ai-error">
            Select some text, or place your cursor in a paragraph (up to{' '}
            {MAX_IMPROVE_LENGTH.toLocaleString()} characters).
          </p>
        )}
        {state.status !== 'generating' && state.error && (
          <p role="alert" className="ai-error">
            {state.error}
          </p>
        )}
        <button
          type="button"
          className="icon-button ai-close"
          aria-label="Close improve writing"
          title="Close (Esc)"
          onClick={dismiss}
        >
          <X size={16} />
        </button>
        <p className="ai-disclosure">
          Sent to Google Gemini. Review before replacing — formatting may be
          simplified.
        </p>
      </div>
      <div className="ai-tray">
        {state.status === 'suggested' ? (
          <>
            <div className="ai-chips">
              <button
                type="button"
                className="ai-chip"
                onClick={improve.editPrompt}
              >
                <PencilLine size={14} />
                Edit prompt
              </button>
              <button
                type="button"
                className="ai-chip"
                onClick={() => void improve.generate()}
              >
                <RotateCcw size={14} />
                Try again
              </button>
            </div>
            <div className="ai-actions">
              <Button variant="ghost" onClick={dismiss}>
                Discard
              </Button>
              <Button onClick={improve.replace}>Replace selection</Button>
            </div>
          </>
        ) : (
          <>
            <div className="ai-chips">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="ai-chip"
                  disabled={!valid || generating}
                  onClick={() => void improve.generate(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            {generating ? (
              <button
                type="button"
                className="ai-submit"
                aria-label="Stop generating"
                onClick={improve.stop}
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                className="ai-submit"
                aria-label="Generate suggestion"
                disabled={!valid}
                onClick={() => void improve.generate()}
              >
                <ArrowUp size={18} />
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
