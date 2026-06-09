import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';

const SetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters.' }),
});

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin');

    const { id } = await params;
    const body = await request.json();
    const parsed = SetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const clientIp = getClientIP(request);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      await systemLog(
        {
          event: 'update',
          userId: session.user.id,
          entityId: id,
          entityType: 'user.password',
          description: 'Password set by administrator.',
          ipAddress: clientIp,
        },
        tx,
      );
    });

    return NextResponse.json({ message: 'Password updated successfully.' }, { status: 200 });
  } catch {
    return routeError(e);
  }
}
