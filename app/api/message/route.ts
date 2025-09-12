export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createAssistantResponseStream } from "../../../lib/openai";

async function getTextFromRequest(req: NextRequest): Promise<string | undefined> {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      return j?.text;
    }
  } catch { /* fall through */ }

  const raw = await req.text();
  // try JSON anyway
  try {
    const j = JSON.parse(raw);
    if (j?.text) return j.text;
  } catch { /* fall through */ }

  // try form/urlencoded: "text=..."
  const p = new URLSearchParams(raw);
  return p.get("text") ?? undefined;
}

export async function POST(req: NextRequest) {
  const text = await getTextFromRequest(req);
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
