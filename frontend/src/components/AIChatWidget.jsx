import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const SUGGESTIONS_BY_ROLE = {
  user: ['Which slots are free right now?', 'What parking locations do you have?', 'Show my recent bookings'],
  // Staff are scoped to their assigned location automatically, so their
  // suggestions stay location-agnostic in wording — the assistant answers
  // for their site either way.
  staff: ['Which slots are free right now?', 'When is parking usually busiest?'],
  admin: ['Revenue by location this month', 'Which location has the most free slots?', 'How many staff accounts do we have?'],
};

export default function AIChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', content: string }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy, open]);

  // Lock the background page from scrolling while the assistant panel is
  // open. Restore whatever the previous value was on close/unmount, so we
  // don't clobber a lock set by some other overlay (e.g. a Modal open at
  // the same time).
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  async function send(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || busy) return;
    setError('');
    setInput('');
    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setBusy(true);

    const d = await apiRequest('/ai/chat', {
      method: 'POST',
      body: { message: trimmed, history: nextMessages.slice(0, -1) },
    });

    setBusy(false);
    if (d && d.success) {
      setMessages((prev) => [...prev, { role: 'assistant', content: d.data.reply }]);
    } else {
      setError((d && d.message) || 'The assistant is unavailable right now.');
    }
  }

  if (!user) return null;
  const suggestions = SUGGESTIONS_BY_ROLE[user.role] || SUGGESTIONS_BY_ROLE.user;

  return (
    <>
      <button
        type="button"
        className="ai-fab"
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        onClick={() => setOpen((v) => !v)}
      >
        <i className={`bi ${open ? 'bi-x-lg' : 'bi-stars'}`} />
      </button>

      {open && (
        <div className="ai-panel">
          <div className="ai-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <i className="bi bi-stars" style={{ color: 'var(--plasma)' }} />
              <span>Parking Assistant</span>
            </div>
            <button type="button" className="ai-panel-close" onClick={() => setOpen(false)} aria-label="Close">
              <i className="bi bi-x-lg" />
            </button>
          </div>

          <div className="ai-panel-body" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="ai-empty">
                <p>
                  Ask me about slot availability, parking locations, your bookings, busy hours, {user.role === 'admin' ? 'revenue, ' : ''}and more.
                  {user.role === 'staff' && user.locationName && (
                    <> I'll answer for <strong>{user.locationName}</strong>, your assigned location.</>
                  )}
                </p>
                <div className="ai-suggestions">
                  {suggestions.map((s) => (
                    <button key={s} type="button" className="ai-suggestion-chip" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ai-msg-${m.role}`}>{m.content}</div>
            ))}
            {busy && <div className="ai-msg ai-msg-assistant ai-msg-thinking"><span /><span /><span /></div>}
            {error && <div className="ai-msg ai-msg-error">{error}</div>}
          </div>

          <form
            className="ai-panel-input"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <input
              type="text"
              placeholder="Ask something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
              <i className="bi bi-send-fill" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}