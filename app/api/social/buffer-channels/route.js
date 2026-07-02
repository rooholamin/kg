import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';

const BUFFER_GRAPHQL = 'https://api.buffer.com';

async function bufferQuery(query, variables = {}) {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) throw new Error('BUFFER_ACCESS_TOKEN is not set');

  const res = await fetch(BUFFER_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Buffer API HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Buffer GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
  }

  return json.data;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    // Step 1: get organizations
    const orgData = await bufferQuery(`
      query {
        account {
          organizations {
            id
            name
          }
        }
      }
    `);

    const organizations = orgData?.account?.organizations ?? [];
    if (!organizations.length) {
      return NextResponse.json({ channels: [], organizations: [] });
    }

    // Step 2: fetch channels for all organizations
    const allChannels = [];
    for (const org of organizations) {
      const channelData = await bufferQuery(
        `query GetChannels($orgId: String!) {
          channels(input: { organizationId: $orgId }) {
            id
            name
            displayName
            service
            avatar
          }
        }`,
        { orgId: org.id },
      );
      const channels = channelData?.channels ?? [];
      channels.forEach((ch) => allChannels.push({ ...ch, organizationId: org.id, organizationName: org.name }));
    }

    return NextResponse.json({ channels: allChannels, organizations });
  } catch (e) {
    return routeError('[GET /api/social/buffer-channels]', e);
  }
}
