const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string

type StreamHandlers = {
  onDelta: (chunk: string) => void
  onDone: () => void
}

export async function createAssistantResponseStream(userText: string, h: StreamHandlers) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY')

  // Responses API with SSE stream=true
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5.1-mini',
      input: [
        { role: 'system', content: 'You are an Ultriva product assistant. Answer concisely.' },
        { role: 'user', content: userText }
      ],
      stream: true
    })
  })

  if (!res.ok || !res.body) {
    h.onDone()
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    // Simple parse for "data: ..." server-sent events format
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') {
        h.onDone()
        return
      }
      try {
        const obj = JSON.parse(payload)
        // Extract delta text if present
        const delta = obj?.output?.[0]?.content?.[0]?.text?.value
        if (delta) h.onDelta(delta)
      } catch {}
    }
  }
  h.onDone()
}
