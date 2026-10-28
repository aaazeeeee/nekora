import StarterKit from '@tiptap/starter-kit';
export const editorExtensions = [
  StarterKit.configure({ heading: { levels: [1, 2] }, link: false }),
];

/** Collaboration supplies its own per-user undo history. */
export const collaborativeEditorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2] },
    link: false,
    undoRedo: false,
  }),
];
