'use client';

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import { cn } from '@/lib/utils';

/**
 * @param {object} props
 * @param {object | null} [props.content] TipTap doc JSON
 * @param {string} [props.className]
 */
export function ContentRenderer({ content, className }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasDoc = (() => {
    if (
      !content ||
      typeof content !== 'object' ||
      content.type !== 'doc' ||
      !Array.isArray(content.content) ||
      content.content.length === 0
    ) {
      return false;
    }
    return !content.content.every((node) => {
      if (node.type === 'paragraph') {
        const inner = node.content || [];
        if (inner.length === 0) return true;
        const text = inner
          .filter((x) => x.type === 'text')
          .map((x) => x.text || '')
          .join('');
        return text.trim() === '';
      }
      return false;
    });
  })();

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [2, 3] } }),
        Link.configure({ openOnClick: true }),
        Image.configure({ inline: false, allowBase64: false }),
        Youtube.configure({ controls: true, width: 640, height: 360 }),
      ],
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      editorProps: {
        attributes: {
          class: cn(
            'text-sm text-foreground',
            'max-w-none',
            '[&_p]:mb-3 [&_p]:leading-relaxed',
            '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2',
            '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2',
            '[&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5',
            '[&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_blockquote]:not-italic',
            '[&_a]:text-primary [&_a]:underline',
            '[&_img]:max-w-full [&_img]:rounded-md',
            '[&_.ProseMirror]:focus:outline-none',
          ),
        },
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor) return;
    if (hasDoc && content) {
      const cur = JSON.stringify(editor.getJSON());
      const next = JSON.stringify(content);
      if (cur !== next) {
        editor.commands.setContent(content, false);
      }
    }
  }, [content, editor, hasDoc]);

  if (!mounted) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!hasDoc) {
    return (
      <p className="text-sm text-muted-foreground">No content yet.</p>
    );
  }

  if (!editor) {
    return <p className="text-sm text-muted-foreground">No content yet.</p>;
  }

  return (
    <div
      className={cn(
        'content-renderer rounded-md border bg-background p-4',
        className,
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
