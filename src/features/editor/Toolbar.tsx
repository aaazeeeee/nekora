import { ImproveWritingButton } from '../ai/ImproveWriting';
import type { ImproveWritingController } from '../ai/useImproveWriting';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Pilcrow,
} from 'lucide-react';
export function Toolbar({
  editor,
  disabled,
  improve,
}: {
  editor: Editor | null;
  disabled: boolean;
  improve: ImproveWritingController;
}) {
  if (!editor) return null;
  const actions = [
    {
      label: 'Undo',
      icon: Undo2,
      run: () => editor.chain().focus().undo().run(),
      active: false,
    },
    {
      label: 'Redo',
      icon: Redo2,
      run: () => editor.chain().focus().redo().run(),
      active: false,
    },
    {
      label: 'Paragraph',
      icon: Pilcrow,
      run: () => editor.chain().focus().setParagraph().run(),
      active: editor.isActive('paragraph'),
    },
    {
      label: 'Heading 1',
      icon: Heading1,
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      active: editor.isActive('heading', { level: 1 }),
    },
    {
      label: 'Heading 2',
      icon: Heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive('heading', { level: 2 }),
    },
    {
      label: 'Bold',
      icon: Bold,
      run: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive('bold'),
    },
    {
      label: 'Italic',
      icon: Italic,
      run: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive('italic'),
    },
    {
      label: 'Underline',
      icon: Underline,
      run: () => editor.chain().focus().toggleUnderline().run(),
      active: editor.isActive('underline'),
    },
    {
      label: 'Bullet list',
      icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive('bulletList'),
    },
    {
      label: 'Numbered list',
      icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive('orderedList'),
    },
  ];
  return (
    <div className="toolbar" role="toolbar" aria-label="Text formatting">
      {actions.map(({ label, icon: Icon, run, active }, index) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={run}
          className={`tool-button ${index === 2 || index === 5 || index === 8 ? 'tool-divider' : ''}`}
        >
          <Icon size={16} />
        </button>
      ))}
      {!disabled && <ImproveWritingButton improve={improve} />}
    </div>
  );
}
