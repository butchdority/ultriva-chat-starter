const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;

type StreamHandlers = { onDelta: (s: string) => void; onDone: () => void };

export async function createAssistantResponseStream(userText: string, h: StreamHandlers) {
  if (!OPENAI_API_KEY) { console.error("OPENAI_API_KEY missing"); h.onDone(); return; }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30000); // 30s safety timeout

  const body = {
    model: "gpt-4o-mini",              // stable, cheap, streams well
    input: [
      { role: "system", content: "You are an Ultriva product assistant. Answer concisely." },
      { role: "user", content: userText }
    ],
    stream: true
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: ac.signal
  }).catch(err => {
    console.error("fetch error", err);
    return undefined;
  });

  clearTimeout(timer);

  if (!res || !res.body) { console.error("no response/body from OpenAI"); h.onDone(); return; }
  if (!res.ok) {
    const text = await res.text().catch(()=>"");
    console.error("OpenAI error", res.status, text);
    h.onDelta(`Error ${res.status}: ${text || "OpenAI request failed"}`);
    h.onDone();
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const s = line.trim();
      if (!s.startsWith("data:")) continue;
      const payload = s.slice(5).trim();
      if (payload === "[DONE]") { h.onDone(); return; }
      try {
        const obj = JSON.parse(payload);
        const delta = obj?.output?.[0]?.content?.[0]?.text?.value;
        if (delta) h.onDelta(delta);
      } catch (e) {
        // surface parsing problems
        console.error("parse error", e, payload);
      }
    }
  }
  h.onDone();
}
