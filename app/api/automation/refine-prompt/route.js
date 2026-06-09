import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { prompt } = await req.json();
    if (!prompt?.trim()) {
      return NextResponse.json({ message: 'prompt is required' }, { status: 400 });
    }

    const webhookUrl = process.env.N8N_PROMPT_REFINER_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ message: 'Prompt refiner webhook not configured' }, { status: 503 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    let n8nRes;
    try {
      n8nRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const bodyText = await n8nRes.text();
    let body = null;
    try { body = JSON.parse(bodyText); } catch { /* raw text */ }

    if (!n8nRes.ok) {
      console.error('[refine-prompt] n8n error', n8nRes.status, bodyText.slice(0, 500));
      return NextResponse.json({ message: 'Refiner workflow failed' }, { status: 502 });
    }

    // n8n returns array from last node
    const data = Array.isArray(body) ? body[0]?.json ?? body[0] : body;
    const refinedPrompt = data?.refinedPrompt ?? data?.prompt ?? null;

    if (!refinedPrompt) {
      console.error('[refine-prompt] no refinedPrompt in response', JSON.stringify(data).slice(0, 300));
      return NextResponse.json({ message: 'No refined prompt returned' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, refinedPrompt });
  } catch (e) {
    if (e?.name === 'AbortError') {
      return NextResponse.json({ message: 'Refiner timed out (60s)' }, { status: 504 });
    }
    console.error('[refine-prompt]', e);
    return NextResponse.json({ message: 'Unexpected error' }, { status: 500 });
  }
}
