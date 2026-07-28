/**
 * Re-uploads a Higgsfield-hosted asset (still or video) to DigitalOcean
 * Spaces, the same CDN every other asset in the app (social slide images,
 * LinkedIn carousel PDFs) already lives on — same bucket/env vars as
 * social-export.service.js's private uploadBufferToS3, just a standalone
 * export here since the video pipeline doesn't go through Playwright.
 */
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3ClientInstance } from '@/lib/s3-client';

export async function uploadUrlToSpaces(sourceUrl, key, contentType) {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to download Higgsfield asset (HTTP ${res.status}): ${sourceUrl}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return uploadBufferToSpaces(buffer, key, contentType);
}

/**
 * Uploads a raw buffer (e.g. an ffmpeg-assembled video, an ElevenLabs music
 * track, or a Captions.ai-captioned render) straight to Spaces — used by
 * video-assembly.service.js, which produces local buffers rather than
 * externally-hosted URLs.
 */
export async function uploadBufferToSpaces(buffer, key, contentType) {
  const s3Client = getS3ClientInstance();
  const bucket = process.env.STORAGE_BUCKET || 'kghub';
  const cdnUrl = process.env.STORAGE_CDN_URL?.replace(/\/$/, '');
  const endpoint = process.env.STORAGE_ENDPOINT?.replace(/\/$/, '');

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
      ACL: 'public-read',
    }),
  );

  return cdnUrl ? `${cdnUrl}/${key}` : `${endpoint}/${key}`;
}
