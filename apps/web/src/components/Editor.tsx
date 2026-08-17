import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface EditorProps {
  value: string;
  onUpdate: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export default function Editor({ value, onUpdate, placeholder, className }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || 'Начните писать…',
      }),
    ],
    content: value || '<p><br></p>',
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose tiptap-editor',
        spellcheck: 'true',
      },
    },
  });

  // Фокусируем редактор при монтировании
  useEffect(() => {
    if (editor) {
      editor.commands.focus();
    }
  }, [editor]);

  // Синхронизируем контент, если value изменился извне
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <div className={`tiptap-wrapper ${className || ''}`}>
      {/* EditorContent монтирует ProseMirror в DOM */}
      <EditorContent editor={editor} />
    </div>
  );
}



