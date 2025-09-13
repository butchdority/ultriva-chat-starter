'use client';

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<string>('');

  // Autoscroll
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Esc cancels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && loading) abortRef.current?.abort();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loading]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;

    // keep caret at end during stream
    setTimeout(() => {
      if (inputRef.current) {
        const el = inputRef.current;
        el.selectionStart = el.selectionEnd = el.value.length;
      }
    }, 0);

    setErrorMsg(null);
    setInput('');
    setLoading(true);
    lastRequestRef.current = text;

    // add user + empty assistant
    setMessages(prev => prev.concat({ role: 'user', content: text }, { role: 'assistant', content: '' }));

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ text }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // stream chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        setMessages(prev => {
          const next = prev.slice();
          const last = next[next.length - 1];
          next[next.length - 1] = {
            role: 'assistant',
            content: (last?.content ?? '') + chunk,
          };
          return next;
        });
      }
    } catch (e: any) {
      setErrorMsg(abortRef.current?.signal.aborted ? 'Request canceled.' : `Request failed. ${e?.message ?? ''}`);
      setInput(lastRequestRef.current); // preserve input for retry
    } finally {
      setLoading(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to send; Shift+Enter newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    setMessages([]);
    setErrorMsg(null);
    setInput('');
    inputRef.current?.focus();
  }

  async function copyLastAnswer() {
    const last = [...messages].reverse().find(m => m.role === 'assistant');
    if (!last) return;
    try { await navigator.clipboard.writeText(last.content.trim()); } catch {}
  }

  function retry() {
    setErrorMsg(null);
    send(lastRequestRef.current);
  }

  return (
    <main style={{ maxWidth: 720, margin: '24px auto', padding: 16, fontSize: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>Ultriva Project Chat</h1>
        <button onClick={clearChat} aria-label="Clear chat" style={btn('ghost')}>Clear</button>
        <button onClick={copyLastAnswer} aria-label="Copy last answer" style={btn('ghost')}>Copy last</button>
      </header>

      {errorMsg && (
        <div role="alert" aria-live="assertive" style={alertBox()}>
          <span>{errorMsg}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={retry} style={btn('primary')}>Retry</button>
            <button onClick={() => setErrorMsg(null)} style={btn('ghost')}>Dismiss</button>
          </div>
        </div>
      )}

      <div
        ref={boxRef}
        role="log"
        aria-live="polite"
        aria-label="Chat transcript"
        style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, minHeight: 320, maxHeight: 520, overflowY: 'auto', background: '#fff' }}
      >
        {messages.length === 0 && <p style={{ color: '#666', margin: 0 }}>Ask a question to begin.</p>}
        {messages.map((m, i) => (
          <div key={i} style={{ whiteSpace: 'pre-wrap', margin: '10px 0' }}>
            <strong>{m.role === 'user' ? 'You' : 'Assistant'}:</strong>{' '}
            {m.content}
            {loading && i === messages.length - 1 && m.role === 'assistant' ? ' ▍' : ''}
          </div>
        ))}
      </div>

      <label htmlFor="composer" className="sr-only">Message</label>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
        <textarea
          id="composer"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder="Type a message. Enter to send, Shift+Enter for newline."
          rows={2}
          aria-label="Type your message"
          style={{ flex: 1, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, outline: 'none', minHeight: 44, resize: 'vertical' }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          aria-disabled={loading || !input.trim()}
          aria-busy={loading}
          style={btn('primary', loading || !input.trim())}
        >
          {loading ? 'Sending…' : 'Send'}
        </button>
      </div>

      <style>{`
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
        button:focus, textarea:focus { outline: 2px solid #4f46e5; outline-offset: 2px; }
      `}</style>
    </main>
  );
}

function btn(kind: 'primary' | 'ghost', disabled = false): React.CSSProperties {
  if (kind === 'ghost') {
    return { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', minHeight: 44 };
  }
  return { padding: '10px 16px', borderRadius: 8, border: '1px solid #111827', background: disabled ? '#9ca3af' : '#111827', color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', minHeight: 44 };
}
function alertBox(): React.CSSProperties {
  return {
    background: '#fff4f4',
    border: '1px solid #f0c2c2',
    color: '#7a1d1d',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  };
}
