'use client'
import { useState } from 'react'

export default function Page() {
  const [messages, setMessages] = useState<{role:'user'|'assistant', content:string}[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    const text = input.trim()
    if (!text) return
    setInput('')
    setLoading(true)
    setMessages(prev => prev.concat([{ role: 'user', content: text }, { role: 'assistant', content: '' }]))

    const res = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    if (!res.body) { setLoading(false); return }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      setMessages(prev => {
        const last = prev[prev.length-1]
        const next = prev.slice()
        next[next.length-1] = { role: 'assistant', content: (last?.content || '') + chunk }
        return next
      })
    }
    setLoading(false)
  }

  return (
    <main style={{ maxWidth: 760, margin: '40px auto', padding: 16 }}>
      <h1>Ultriva Project Chat</h1>
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minHeight: 300 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ whiteSpace: 'pre-wrap', margin: '8px 0' }}>
            <strong>{m.role === 'user' ? 'You' : 'Assistant'}:</strong> {m.content}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') send()}}
               placeholder="Type a message" style={{ flex: 1, padding: 10, border: '1px solid #ccc', borderRadius: 6 }} />
        <button onClick={send} disabled={loading} style={{ padding: '10px 16px', borderRadius: 6, border: '1px solid #333' }}>
          {loading ? 'Sending' : 'Send'}
        </button>
      </div>
    </main>
  )
}
