// lib/openai.ts
const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;

type StreamHandlers = {
  onDelta: (chunk: string) => void;
  onDone: () => void;
};

export async function createAssistantResponseStream(
  userText: string,
  h: StreamHandlers
) {
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY missing");
    h.onDone();
    return;
  }

  const body = {
    model: "gpt-4o-mini-2024-07-18",
    input: [
      { role: "system", content: "You are an Ultriva product assistant. Answer concisely." },
      { role: "user", content: userText }
    ],
    stream: true
  };

  console.log("OpenAI request body", JSON.stringify(body));

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 30_000);

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: ac.signal
  }).catch(err => {
    console.error("fetch error", err);
    return undefined;
  });

  clearTimeout(timeout);

  if (!res) {
    console.error("no response object");
    h.onDone();
    return;
  }
  console.log("OpenAI response status", res.status);

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    console.error("OpenAI error", res.status, txt);
    h.onDelta(`Error ${res.status}: ${txt || "request failed"}`);
    h.onDone();
    return;
  }

  // --- Robust SSE line parser with buffering ---
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // split into complete lines; keep remainder in buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith(":")) continue;      // comments / keepalive
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          console.log("delta:[DONE]");
          h.onDone();
          return;
        }

        try {
          const obj = JSON.parse(payload);

          // Prefer true delta events from the Responses stream API
          let delta = "";
          if (obj?.type === "response.output_text.delta") {
            delta = obj?.delta ?? "";
          } else if (obj?.type === "response.output_text") {
            // some SDKs emit full chunks in this type; treat as delta
            delta = obj?.output_text ?? "";
          } else if (obj?.type === "response.completed") {
            // nothing to emit here; completion marker
          } else {
            // fallback for older/alternate shapes
            delta =
              obj?.output?.[0]?.content?.[0]?.text?.value ??
              obj?.output_text ??
              "";
          }

          if (delta) {
            console.log("stream:delta", delta.length);
            h.onDelta(delta);
          }
        } catch (e) {
          // If an incomplete fragment slipped through, log and continue
          console.error("parse error", (e as Error).message, payload.slice(0, 200));
        }
      }
    }
  } catch (e) {
    console.error("stream read error", e);
  }

  console.log("stream:done");
  h.onDone();
}
