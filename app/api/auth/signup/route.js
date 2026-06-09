import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { message: 'Public registration is disabled. Contact an administrator to get access.' },
    { status: 403 },
  );
}
