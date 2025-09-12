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
      console.log("stream:start");
      createAssistantResponseStream(text, {
        onDelta: (delta) => {
          controller.enqueue(encoder.encode(delta + "\n"));
          console.log("stream:delta", delta.length);
        },
        onDone: () => {
          console.log("stream:done");
          controller.close();
        },
      });
    },
    cancel() {
      console.log("stream:cancel");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Transfer-Encoding": "chunked",
    },
  });
}
