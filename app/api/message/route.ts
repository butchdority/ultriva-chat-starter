export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createAssistantResponseStream } from "../../../lib/openai";

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text) return new Response("Bad Request", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      createAssistantResponseStream(text, {
        onDelta: (delta) => controller.enqueue(encoder.encode(delta)),
        onDone: () => controller.close(),
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
