// lib/openai.ts
const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;

type StreamHandlers = { onDelta: (chunk: string) => void; onDone: () => void };

export async function createAssistantResponseStream(userText: string, h: StreamHandlers) {
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

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 30_000);

  console.log("OpenAI request body", JSON.stringify(body));

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: ac.signal
  }).catch(err => { console.error("fetch error", err); return undefined; });

  clearTimeout(timeout);

  if (!res || !res.body) { console.error("no response/body from OpenAI"); h.onDone(); return; }
  console.log("OpenAI response status", res.status);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("OpenAI error", res.status, text);
    h.onDelta(`Error ${res.status}: ${text || "request failed"}`); h.onDone(); return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const s = line.trim();
        if (!s || s.startsWith(":")) continue;
        if (!s.startsWith("data:")) continue;

        const payload = s.slice(5).trim();
        if (payload === "[DONE]") { h.onDone(); return; }

        try {
          const obj = JSON.parse(payload);
          const delta =
            obj?.output?.[0]?.content?.[0]?.text?.value ??
            obj?.output_text ?? "";
          if (delta) {
            console.log("delta", delta.length, delta.slice(0, 80)); // <-- log length + snippet
            h.onDelta(delta);
          }
        } catch (e) {
          console.error("parse error", (e as Error).message, payload.slice(0, 200));
        }
      }
    }
  } catch (e) {
    console.error("stream read error", e);
  }

  h.onDone();
}
