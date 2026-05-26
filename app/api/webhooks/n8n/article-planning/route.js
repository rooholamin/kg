import { NextResponse } from 'next/server';
import { updateSlotFromWebhook } from '@/services/scheduler.service';

export async function POST(request) {
  try {
    // Verify shared secret
    const secret = process.env.N8N_WEBHOOK_SECRET;
    if (secret) {
      const incomingSecret = request.headers.get('x-webhook-secret');
      if (incomingSecret !== secret) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();

    if (!body?.slotId) {
      return NextResponse.json({ message: 'slotId is required' }, { status: 400 });
    }

    const result = await updateSlotFromWebhook(body);
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    console.error('[api/webhooks/n8n/article-planning POST]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    if (e?.code === 'VALIDATION') {
      return NextResponse.json({ message: e.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Failed to process webhook' }, { status: 500 });
  }
}
