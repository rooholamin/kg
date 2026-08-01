import { Instagram, Linkedin, Twitter } from 'lucide-react';

// Shared Buffer-channel config for the video pipeline's `platforms` array
// (VideoSettings.defaultPlatforms / VideoPost.platforms) — every video is one
// row that can fan out to several of these at once, unlike Social where each
// platform gets its own separate SocialPost row.
export const VIDEO_PLATFORM_OPTIONS = [
  { key: 'instagram_carousel', label: 'Instagram', Icon: Instagram, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin, color: 'text-blue-600', bg: 'bg-blue-600/10' },
  { key: 'twitter', label: 'Twitter / X', Icon: Twitter, color: 'text-zinc-700 dark:text-zinc-300', bg: 'bg-zinc-500/10' },
];

export function videoPlatformConfig(key) {
  return VIDEO_PLATFORM_OPTIONS.find((p) => p.key === key) || null;
}
