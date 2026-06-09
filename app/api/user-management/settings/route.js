import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 }, // Unauthorized
      );
    }

    requireRole(session, 'superadmin', 'admin');

    // Get settings
    const settings = await prisma.systemSetting.findFirst();

    // Fetch all roles from the UserRole table and sort by name
    const roles = await prisma.userRole.findMany({
      select: { id: true, name: true }, // Adjust selection based on your schema
      orderBy: { name: 'asc' }, // Sort by name in ascending order
    });

    // Return the setting and sorted role list data
    return NextResponse.json({ settings, roles });
  } catch (error) {
    return routeError(error, 'Failed to load settings');
  }
}
