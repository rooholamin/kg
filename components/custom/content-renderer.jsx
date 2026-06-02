'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import { Node, mergeAttributes } from '@tiptap/core';
import { cn } from '@/lib/utils';

/**
 * Custom TipTap node for AI-generated image placeholders.
 * Renders a styled dashed box with the image prompt so editors
 * can see where images will appear before assets are generated.
 */
const ImagePlaceholderExtension = Node.create({
  name: 'imagePlaceholder',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      placementKey: { default: null },
      prompt: { default: null },
      assetType: { default: 'inline_image' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-image-placeholder]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-image-placeholder': '' }),
      HTMLAttributes.prompt || HTMLAttributes.placementKey || 'Image placeholder',
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-image-placeholder', '');
      dom.style.cssText = [
        'border: 2px dashed #a78bfa',
        'border-radius: 8px',
        'padding: 12px 16px',
        'margin: 12px 0',
        'background: #f5f3ff',
        'color: #7c3aed',
        'font-size: 12px',
        'display: flex',
        'align-items: center',
        'gap: 8px',
      ].join(';');

      const label = document.createElement('span');
      label.style.cssText = 'font-weight:600;white-space:nowrap';
      label.textContent = node.attrs.assetType === 'featured_image' ? '🖼 Featured image' : '🖼 Inline image';

      const prompt = document.createElement('span');
      prompt.style.cssText = 'color:#6d28d9;opacity:0.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      prompt.textContent = node.attrs.prompt ? `— ${node.attrs.prompt}` : '';

      dom.appendChild(label);
      dom.appendChild(prompt);

      return { dom };
    };
  },
});

// ---------------------------------------------------------------------------
// Article-body prose classes (shared between HTML and TipTap renderers)
// ---------------------------------------------------------------------------

const PROSE_CLS = cn(
  'text-sm text-foreground max-w-none',
  '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-4 [&_h1]:leading-tight',
  '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3',
  '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2',
  '[&_p]:mb-4 [&_p]:leading-relaxed',
  '[&_ul]:list-disc [&_ul]:ps-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:mb-4',
  '[&_li]:mb-1',
  '[&_blockquote]:border-s-4 [&_blockquote]:border-violet-300 [&_blockquote]:ps-4 [&_blockquote]:py-1 [&_blockquote]:my-4 [&_blockquote]:text-muted-foreground [&_blockquote]:italic',
  '[&_strong]:font-semibold',
  '[&_a]:text-primary [&_a]:underline',
  '[&_img]:max-w-full [&_img]:rounded-md [&_img]:my-4',
  // image-placeholder divs from HTML format
  '[&_.image-placeholder]:flex [&_.image-placeholder]:items-center [&_.image-placeholder]:gap-2',
  '[&_.image-placeholder]:border-2 [&_.image-placeholder]:border-dashed [&_.image-placeholder]:border-violet-300',
  '[&_.image-placeholder]:rounded-lg [&_.image-placeholder]:px-4 [&_.image-placeholder]:py-3 [&_.image-placeholder]:my-4',
  '[&_.image-placeholder]:bg-violet-50 [&_.image-placeholder]:dark:bg-violet-950/20 [&_.image-placeholder]:text-violet-700 [&_.image-placeholder]:dark:text-violet-300 [&_.image-placeholder]:text-xs',
);

/**
 * Renders HTML-format article content ( { type:'html', html:'...' } ).
 * Image placeholders are shown as styled dashed boxes.
 * When `onDeleteImage` is provided, each <img> gets a hoverable delete button.
 */
function HtmlRenderer({ html, className, onDeleteImage }) {
  const ref = useRef(null);

  // Enrich image-placeholder divs with a visible label
  const enriched = html.replace(
    /<div([^>]*class="image-placeholder"[^>]*)><\/div>/gi,
    (match, attrs) => {
      const keyM = attrs.match(/data-placement-key="([^"]+)"/i);
      const promptM = attrs.match(/data-prompt="([^"]+)"/i);
      const typeM = attrs.match(/data-asset-type="([^"]+)"/i);
      const isFeatured = typeM?.[1] === 'featured_image';
      const label = isFeatured ? '🖼 Featured image' : '🖼 Inline image';
      const promptText = promptM ? ` — ${promptM[1]}` : (keyM ? ` (${keyM[1]})` : '');
      return `<div${attrs}><span style="font-weight:600">${label}</span><span style="opacity:0.7">${promptText}</span></div>`;
    },
  );

  // Inject delete buttons on every <img> after render
  useEffect(() => {
    if (!ref.current || !onDeleteImage) return;

    const imgs = ref.current.querySelectorAll('img');
    imgs.forEach((img) => {
      if (img.dataset.hasDeleteBtn) return;
      img.dataset.hasDeleteBtn = 'true';

      // Wrap in a relative container if not already inside a <figure>
      let wrapper = img.closest('figure');
      if (!wrapper) {
        wrapper = document.createElement('span');
        wrapper.style.cssText = 'position:relative;display:inline-block;';
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);
      } else {
        wrapper.style.position = 'relative';
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = 'Remove image from article';
      btn.style.cssText = [
        'position:absolute',
        'top:6px',
        'right:6px',
        'width:24px',
        'height:24px',
        'border-radius:50%',
        'background:rgba(239,68,68,0.9)',
        'color:#fff',
        'border:none',
        'cursor:pointer',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'font-size:16px',
        'font-weight:700',
        'line-height:1',
        'box-shadow:0 1px 4px rgba(0,0,0,0.3)',
        'opacity:0',
        'transition:opacity 0.15s',
        'z-index:10',
      ].join(';');
      btn.textContent = '×';

      // Show/hide on parent hover
      const show = () => { btn.style.opacity = '1'; };
      const hide = () => { btn.style.opacity = '0'; };
      wrapper.addEventListener('mouseenter', show);
      wrapper.addEventListener('mouseleave', hide);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteImage(img.src, img.closest('figure') ?? img);
      });

      wrapper.appendChild(btn);
    });
  }, [enriched, onDeleteImage]);

  return (
    <div
      ref={ref}
      className={cn(PROSE_CLS, className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: enriched }}
    />
  );
}

/**
 * @param {object} props
 * @param {{ type: 'html', html: string } | { type: 'doc', content: object[] } | null} [props.content]
 * @param {string} [props.className]
 */
export function ContentRenderer({ content, className, onDeleteImage }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine content format
  const isHtml = content?.type === 'html' && typeof content.html === 'string' && content.html.trim().length > 0;

  const hasDoc = (() => {
    if (!content || typeof content !== 'object') return false;
    if (isHtml) return true;
    if (
      content.type !== 'doc' ||
      !Array.isArray(content.content) ||
      content.content.length === 0
    ) return false;
    return content.content.some((node) => {
      if (node.type !== 'paragraph') return true;
      const text = (node.content || [])
        .filter((x) => x.type === 'text')
        .map((x) => x.text || '')
        .join('');
      return text.trim().length > 0;
    });
  })();

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Link.configure({ openOnClick: true }),
        Image.configure({ inline: false, allowBase64: false }),
        Youtube.configure({ controls: true, width: 640, height: 360 }),
        ImagePlaceholderExtension,
      ],
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      editorProps: {
        attributes: { class: cn(PROSE_CLS, '[&_.ProseMirror]:focus:outline-none') },
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor || isHtml) return;
    if (hasDoc && content) {
      const cur = JSON.stringify(editor.getJSON());
      const next = JSON.stringify(content);
      if (cur !== next) {
        editor.commands.setContent(content, false);
      }
    }
  }, [content, editor, hasDoc, isHtml]);

  if (!mounted) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!hasDoc) {
    return <p className="text-sm text-muted-foreground">No content yet.</p>;
  }

  // HTML path — no TipTap needed
  if (isHtml) {
    return (
      <div className={cn('content-renderer rounded-md border bg-background p-4 sm:p-6', className)}>
        <HtmlRenderer html={content.html} onDeleteImage={onDeleteImage} />
      </div>
    );
  }

  if (!editor) {
    return <p className="text-sm text-muted-foreground">No content yet.</p>;
  }

  return (
    <div className={cn('content-renderer rounded-md border bg-background p-4 sm:p-6', className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
