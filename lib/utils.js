import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class names, resolving any conflicts.
 *
 * @param inputs - An array of class names to merge.
 * @returns A string of merged and optimized class names.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * YouTube watch / youtu.be / shorts → embed URL
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function toYoutubeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (!t) return null;
  const host = t.includes('://') ? t : `https://${t}`;

  try {
    const u = new URL(host);
    const hostn = u.hostname.replace(/^www\./, '');

    if (hostn === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '');
      if (id) {
        return `https://www.youtube.com/embed/${id.split('/')[0]}`;
      }
    }

    if (hostn.includes('youtube.com')) {
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.replace('/shorts/', '').split('/')[0];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      if (u.pathname.startsWith('/embed/')) {
        return t.startsWith('http') ? t : `https:${t}`;
      }
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
  } catch {
    return null;
  }
  return null;
}
