import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { uploadToS3 } from '@/lib/s3-upload';

const ALLOWED_DIRECTORIES = new Set([
  'articles',
  'galleries',
  'editor-inline',
  'covers',
  'characters',
  'video-outro',
]);

const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime']);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * @param {Request} request
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }
    requireRole(session, 'superadmin', 'admin', 'editor');

    const formData = await request.formData();
    const file = formData.get('file');
    const directoryRaw = formData.get('directory')?.toString() || 'articles';
    const directory = ALLOWED_DIRECTORIES.has(directoryRaw)
      ? directoryRaw
      : 'articles';

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { message: 'No file provided' },
        { status: 400 },
      );
    }

    const isVideoDir = directory === 'video-outro';
    const maxBytes = isVideoDir ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const allowedMimes = isVideoDir ? ALLOWED_VIDEO_MIMES : ALLOWED_IMAGE_MIMES;

    if (file.size > maxBytes) {
      return NextResponse.json(
        { message: `File is too large (max ${maxBytes / (1024 * 1024)} MB)` },
        { status: 400 },
      );
    }

    if (!allowedMimes.has(file.type)) {
      return NextResponse.json(
        { message: isVideoDir ? 'Invalid file type. Use MP4 or MOV.' : 'Invalid file type. Use PNG, JPEG, WebP, or GIF.' },
        { status: 400 },
      );
    }

    const url = await uploadToS3(file, directory);
    return NextResponse.json({ data: { url } });
  } catch (e) {
    console.error('[api/uploads POST]', e);
    return NextResponse.json(
      { message: e?.message || 'Failed to upload file' },
      { status: 500 },
    );
  }
}
