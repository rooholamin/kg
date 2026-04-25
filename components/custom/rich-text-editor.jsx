'use client';

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Quote,
  Undo2,
  Youtube as YoutubeIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ImageUploadInput } from '@/components/custom/image-upload-input';

const defaultDoc = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

/**
 * @param {object} props
 * @param {object | null} [props.value]
 * @param {(json: object) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {string} [props.className]
 */
export function RichTextEditor({ value, onChange, placeholder, className }) {
  const [imageOpen, setImageOpen] = useState(false);

  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
        }),
        Image.configure({
          inline: false,
          allowBase64: false,
        }),
        Youtube.configure({
          controls: true,
          nocookie: true,
          width: 640,
          height: 360,
        }),
        Placeholder.configure({
          placeholder: placeholder || 'Start writing your article body…',
        }),
      ],
      content: value && value.type === 'doc' ? value : defaultDoc,
      onUpdate: ({ editor: ed }) => {
        onChange(ed.getJSON());
      },
      editorProps: {
        attributes: {
          class: cn(
            'min-h-[320px] focus:outline-none px-3 py-2',
            '[&_p]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold',
            '[&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5',
            '[&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground',
            '[&_iframe]:max-w-full [&_iframe]:rounded-md',
          ),
        },
      },
    },
    [placeholder],
  );

  useEffect(() => {
    if (!editor || !value || value.type !== 'doc') return;
    const a = JSON.stringify(editor.getJSON());
    const b = JSON.stringify(value);
    if (a !== b) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          'min-h-[320px] rounded-md border border-dashed text-sm text-muted-foreground flex items-center justify-center',
          className,
        )}
      >
        Loading editor…
      </div>
    );
  }

  const setYoutubeFromPrompt = () => {
    const src = window.prompt('Paste YouTube URL');
    if (src?.trim()) {
      editor.chain().focus().setYoutubeVideo({ src: src.trim() }).run();
    }
  };

  const setLinkFromPrompt = () => {
    const href = window.prompt('Link URL', 'https://');
    if (href?.trim()) {
      editor.chain().focus().setLink({ href: href.trim() }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-0.5 rounded-md border bg-muted/30 p-1">
        <ToolbarIcon
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          label="H2"
        >
          <Heading2 className="size-4" />
        </ToolbarIcon>
        <ToolbarIcon
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          label="H3"
        >
          <Heading3 className="size-4" />
        </ToolbarIcon>
        <ToolbarIcon
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          <Bold className="size-4" />
        </ToolbarIcon>
        <ToolbarIcon
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          <Italic className="size-4" />
        </ToolbarIcon>
        <ToolbarIcon onClick={setLinkFromPrompt} active={editor.isActive('link')}>
          <Link2 className="size-4" />
        </ToolbarIcon>
        <ToolbarIcon
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
        >
          <List className="size-4" />
        </ToolbarIcon>
        <ToolbarIcon
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
        >
          <ListOrdered className="size-4" />
        </ToolbarIcon>
        <ToolbarIcon
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
        >
          <Quote className="size-4" />
        </ToolbarIcon>
        <ToolbarIcon onClick={() => setImageOpen(true)}>
          <ImageIcon className="size-4" />
        </ToolbarIcon>
        <ToolbarIcon onClick={setYoutubeFromPrompt}>
          <YoutubeIcon className="size-4" />
        </ToolbarIcon>
        <div className="w-px bg-border mx-0.5 self-stretch" />
        <ToolbarIcon onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="size-4" />
        </ToolbarIcon>
        <ToolbarIcon onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="size-4" />
        </ToolbarIcon>
      </div>
      <div className="rounded-md border bg-background">
        <EditorContent editor={editor} />
      </div>

      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert image</DialogTitle>
          </DialogHeader>
          <ImageUploadInput
            directory="editor-inline"
            label="Upload or paste image URL"
            value={null}
            onChange={(u) => {
              if (u) {
                editor.chain().focus().setImage({ src: u }).run();
              }
              setImageOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolbarIcon({ children, onClick, active, label, title }) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className="size-8"
      onClick={onClick}
      title={title || label}
    >
      {children}
    </Button>
  );
}
