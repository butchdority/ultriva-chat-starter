export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createAssistantResponseStream } from "../../../lib/openai";

// Read body once. Accept JSON or form-encoded.
async function getText(req: NextRequest): Promise<string | undefined> {
  const ct = req.headers.get("content-type") || "";

  // Try JSON on a clone (so we can still read raw later if it fails).
  if (ct.includes("application/json")) {
    try {
      const j = await req.clone().json();
      if (j?.text) return String(j.text);
    } catch { /* fall through */ }
  }

  // Read raw once from the original request.
  const raw = await req.text();

  // Try JSON-from-text.
  try {
    const j = JSON.parse(raw);
    if (j?.text) return String(j.text);
  } catch { /* ignore */ }

  // Try urlencoded: "text=..."
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
          controller.enqueue(encoder.encode(delta + "\n")); // flush-friendly
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
