export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const signature = req.headers.get('x-webhook-signature') || ''
  const secret = process.env.WEBHOOK_SIGNING_SECRET || ''
  const digest = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  if (secret && signature !== digest) {
    return new Response('Invalid signature', { status: 401 })
  }
  // In a real app, parse event and act
  // For demo, just acknowledge
  return new Response('ok')
}
