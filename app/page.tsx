'use client'
import { useEffect, useRef, useState } from 'react'

export default function Page() {
  const [messages, setMessages] = useState<{role:'user'|'assistant', content:string}[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const evtSrcRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // open SSE stream on mount
    const es = new EventSource('/api/stream')
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'assistant_chunk') {
          setMessages(prev => {
            const last = prev[prev.length-1]
            if (last && last.role === 'assistant') {
              // append
              const copy = prev.slice()
              copy[copy.length-1] = { role: 'assistant', content: last.content + data.delta }
              return copy
            }
            return prev.concat([{ role: 'assistant', content: data.delta }])
          })
        } else if (data.type === 'assistant_done') {
          setLoading(false)
        }
      } catch {}
    }
    es.onerror = () => {}
    evtSrcRef.current = es
    return () => { es.close() }
  }, [])

  async function send() {
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    setLoading(true)
    setMessages(prev => prev.concat([{ role: 'user', content: text }, { role: 'assistant', content: '' }]))
    await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
  }

  return (
    <main style={{ maxWidth: 760, margin: '40px auto', padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Ultriva Project Chat</h1>
      <p style={{ color: '#555', marginBottom: 24 }}>Webhook-enabled demo. No login in starter.</p>
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minHeight: 300 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ whiteSpace: 'pre-wrap', margin: '8px 0' }}>
            <strong>{m.role === 'user' ? 'You' : 'Assistant'}:</strong> {m.content}
          </div>
        ))}
        {messages.length === 0 && <div style={{ color: '#777' }}>Start by asking a question.</div>}
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
