import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { randomizePlatformSchedule } from '@/services/buffer.service';
import { logInfo } from '@/lib/social-logger';

const VALID_PLATFORMS = ['instagram_carousel', 'instagram_story', 'linkedin', 'twitter'];
const VALID_MODES = ['even', 'random'];

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const { platform, mode, daysMask, windowStart, windowEnd } = await req.json();

    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ message: `Invalid platform: ${platform}` }, { status: 400 });
    }
    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json({ message: `Invalid mode: ${mode}` }, { status: 400 });
    }

    const { count } = await randomizePlatformSchedule({
      campaignId: id,
      platform,
      mode,
      daysMask,
      windowStart,
      windowEnd,
    });

    await logInfo(
      id, 'schedule_randomized',
      `Rescheduled ${count} ${platform} post${count !== 1 ? 's' : ''} (${mode === 'random' ? 'randomized' : 'even spread'})`,
      { platform, mode, daysMask, windowStart, windowEnd, count },
    );

    return NextResponse.json({ count });
  } catch (e) {
    return routeError('[POST /api/social/campaigns/[id]/randomize]', e);
  }
}
