'use client';

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);
    setMessages(prev => prev.concat({ role: 'user', content: text }, { role: 'assistant', content: '' }));

    try {
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ text }),
      });

      if (!res.ok || !res.body) {
        setMessages(prev => {
          const next = prev.slice();
          next[next.length - 1] = { role: 'assistant', content: `Error ${res.status}` };
          return next;
        });
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        setMessages(prev => {
          const next = prev.slice();
          const last = next[next.length - 1]?.content ?? '';
          next[next.length - 1] = { role: 'assistant', content: last + chunk };
          return next;
        });
      }
    } catch (e:any) {
      setMessages(prev => {
        const next = prev.slice();
        next[next.length - 1] = { role: 'assistant', content: `Network error: ${e?.message || e}` };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '40px auto', padding: 16 }}>
      <h1>Ultriva Project Chat</h1>
      <div
        ref={boxRef}
        style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minHeight: 320, maxHeight: 520, overflowY: 'auto' }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ whiteSpace: 'pre-wrap', margin: '8px 0' }}>
            <strong>{m.role === 'user' ? 'You' : 'Assistant'}:</strong> {m.content}
          </div>
        ))}
        {messages.length === 0 && <div style={{ color: '#888' }}>Ask a question to begin.</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder="Type a message"
          disabled={loading}
          style={{ flex: 1, padding: 10, border: '1px solid #ccc', borderRadius: 6 }}
        />
        <button onClick={send} disabled={loading} style={{ padding: '10px 16px', borderRadius: 6, border: '1px solid #333' }}>
          {loading ? 'Sending' : 'Send'}
        </button>
      </div>
    </main>
  );
}
