import { toast } from 'sonner';

export function videoPostTitle(post) {
  return post?.article?.title || post?.customTitle || 'Untitled video';
}

/**
 * Toasts for work scoped to one video post.
 *
 * Video work is slow and runs per post, and React Query doesn't cancel a
 * mutation when you navigate away — so a segment regeneration started on one
 * post routinely reports back while you're looking at a different one. An
 * unlabelled "Regeneration failed" in that situation is unactionable: there's
 * no way to tell which video it came from. Every toast therefore names its post
 * and offers a jump to it.
 */
export function postToast(post) {
  const postId = post?.id;
  const title = videoPostTitle(post);

  const options = () => {
    const onPostPage = typeof window !== 'undefined' && window.location.pathname.includes(postId ?? '\0');
    return {
      description: title,
      duration: 8000,
      ...(postId && !onPostPage
        ? { action: { label: 'Open', onClick: () => window.location.assign(`/dashboard/video/posts/${postId}`) } }
        : {}),
    };
  };

  return {
    success: (message) => toast.success(message, options()),
    error: (message) => toast.error(message, options()),
  };
}
