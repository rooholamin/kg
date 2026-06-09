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
]);

const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

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

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { message: 'File is too large (max 10 MB)' },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json(
        { message: 'Invalid file type. Use PNG, JPEG, WebP, or GIF.' },
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
