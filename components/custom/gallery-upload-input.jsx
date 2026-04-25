'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * @param {object} props
 * @param {string[]} props.value
 * @param {(urls: string[]) => void} props.onChange
 * @param {string} [props.directory]
 * @param {string} [props.label]
 * @param {number} [props.max]
 * @param {string} [props.className]
 */
export function GalleryUploadInput({
  value = [],
  onChange,
  directory = 'galleries',
  label = 'Gallery images',
  max = 10,
  className,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const canAdd = value.length < max;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!canAdd) {
      toast.error(`Maximum ${max} images`);
      return;
    }
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
      const url = j.data?.url;
      if (url) onChange([...value, url]);
      toast.success('Image added to gallery');
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const remove = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm">{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
        disabled={uploading || !canAdd}
      />
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {value.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute end-1 top-1 size-6 opacity-0 group-hover:opacity-100"
              onClick={() => remove(i)}
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground text-xs hover:bg-muted/50"
          >
            {uploading ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <>
                <ImagePlus className="size-6 opacity-50" />
                Add
              </>
            )}
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Up to {max} images. Use the article form’s featured image for the hero.
      </p>
    </div>
  );
}
