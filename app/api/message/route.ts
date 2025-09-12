export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server'
import { createAssistantResponseStream } from '../../../lib/openai'


export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return new Response('Bad Request', { status: 400 })

  const push = (globalThis as any).__SSE_PUSH__ as ((data:any)=>void) | undefined
  if (!push) return new Response('No stream', { status: 500 })

  // Kick off streamed response
  createAssistantResponseStream(text, {
    onDelta: (delta) => push({ type: 'assistant_chunk', delta }),
    onDone: () => push({ type: 'assistant_done' }),
  }).catch(() => push({ type: 'assistant_done' }))

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}
