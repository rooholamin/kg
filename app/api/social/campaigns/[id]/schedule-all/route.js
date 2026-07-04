import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { scheduleAllPosts } from '@/services/social-pipeline.service';

const VALID_PLATFORMS = ['instagram_carousel', 'instagram_story', 'linkedin', 'twitter'];

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;

    // Body is optional — "Schedule All" sends none, "Schedule this channel"
    // sends { platform }.
    let platform;
    try {
      const body = await req.json();
      platform = body?.platform;
    } catch {
      platform = undefined;
    }

    if (platform && !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ message: `Invalid platform: ${platform}` }, { status: 400 });
    }

    const scheduled = await scheduleAllPosts(id, platform);
    return NextResponse.json({ scheduled });
  } catch (e) {
    return routeError('[POST /api/social/campaigns/[id]/schedule-all]', e);
  }
}
