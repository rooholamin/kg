'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, Link2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { cn } from '@/lib/utils';

const DEFAULT_LABEL = 'Image';

/**
 * @param {object} props
 * @param {string | null} props.value
 * @param {(url: string | null) => void} props.onChange
 * @param {string} [props.directory]
 * @param {string} [props.label]
 * @param {string} [props.className]
 */
export function ImageUploadInput({
  value,
  onChange,
  directory = 'articles',
  label = DEFAULT_LABEL,
  className,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlDraft, setUrlDraft] = useState(value || '');

  useEffect(() => {
    if (urlMode) setUrlDraft(value || '');
  }, [urlMode, value]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('directory', directory);
      const res = await apiFetch('/api/uploads', { method: 'POST', body: formData });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.message || 'Upload failed');
      }
      onChange(j.data?.url || null);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setUrlMode(!urlMode);
            if (!urlMode && value) setUrlDraft(value);
          }}
        >
          <Link2 className="size-3.5 me-1" />
          {urlMode ? 'Upload file' : 'Use URL'}
        </Button>
      </div>

      {urlMode ? (
        <div className="space-y-2">
          <Input
            placeholder="https://…"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onBlur={() => {
              const t = urlDraft.trim();
              onChange(t || null);
            }}
          />
          <p className="text-[10px] text-muted-foreground">
            Paste a CDN or AI-generated image URL.
          </p>
        </div>
      ) : (
        <div
          className={cn(
            'rounded-md border border-dashed border-border bg-muted/30 p-3',
            uploading && 'opacity-70 pointer-events-none',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleFile}
            disabled={uploading}
          />
          {value ? (
            <div className="space-y-2">
              <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-md border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </AspectRatio>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="size-4 me-1" />
                      Replace
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2 py-6 text-sm text-muted-foreground hover:text-foreground"
            >
              {uploading ? (
                <Loader2 className="size-8 animate-spin" />
              ) : (
                <ImagePlus className="size-8 opacity-50" />
              )}
              {uploading ? 'Uploading…' : 'Click to upload (PNG, JPEG, WebP, GIF, max 10 MB)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
