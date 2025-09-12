export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server'
import { getEventStream } from '../../../lib/stream'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  const { readable, push, close } = getEventStream()
  // store broadcaster for other routes
  globalThis.__SSE_PUSH__ = push
  globalThis.__SSE_CLOSE__ = close
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
