export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createAssistantResponseStream } from "../../../lib/openai";

// Read 'text' safely from JSON or urlencoded, without double-reading the body
async function getText(req: NextRequest): Promise<string | undefined> {
  const ct = req.headers.get("content-type") || "";

  // If JSON, try parsing on a clone so we can still fallback if it fails
  if (ct.includes("application/json")) {
    try {
      const j = await req.clone().json();
      if (j?.text) return j.text as string;
    } catch { /* fall through to raw text */ }
  }

  // Read raw text once from the original request
  const raw = await req.text();

  // Try JSON-from-text
  try {
    const j = JSON.parse(raw);
    if (j?.text) return j.text as string;
  } catch { /* ignore */ }

  // Try form urlencoded: "text=..."
  const p = new URLSearchParams(raw);
  return p.get("text") ?? undefined;
}

export async function POST(req: NextRequest) {
  const text = await getText(req);
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
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Transfer-Encoding": "chunked",
    },
  });
}
