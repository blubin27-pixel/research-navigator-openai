'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

// Chat page for History search

type Role = 'user' | 'assistant';

type Source = {
  title: string;
  url: string;
  host: string;
  year?: number;
  authors?: string[];
  whyRelevantBullets: string[];
};

type TopPlace = {
  name: string;
  url: string;
  why: string;
};

type ApiResult =
  | { decision: 'refuse'; refusalReason: string }
  | {
      decision: 'allow';
      interpretationBullets?: string[];
      topPlaces?: TopPlace[];
      searchQueries?: string[];
      sources?: Source[];
      readingOrder?: string[];
      nextSteps?: string[];
    };

type Message = { role: Role; content: string; data?: ApiResult };

export default function HistoryPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hi — I'm SchoolSafeAI. Tell me a research topic and I'll find credible, free sources. I won't write your paper.",
    },
  ]);
  const [input, setInput] = useState('');
  const [depth, setDepth] = useState<'quick' | 'deep'>('quick');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function send() {
    if (!canSend) return;
    const userText = input.trim();
    setInput('');
    setMessages((msgs) => [...msgs, { role: 'user', content: userText }]);
    setLoading(true);
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depth,
          messages: [...messages, { role: 'user', content: userText }].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const raw = await res.text();
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`);
      const data: ApiResult = JSON.parse(raw);
      if (data.decision === 'refuse') {
        setMessages((msgs) => [
          ...msgs,
          {
            role: 'assistant',
            content: data.refusalReason || 'Request refused.',
            data,
          },
        ]);
      } else {
        setMessages((msgs) => [
          ...msgs,
          {
            role: 'assistant',
            content: 'Here are your research results.',
            data,
          },
        ]);
      }
    } catch (e: any) {
      setMessages((msgs) => [
        ...msgs,
        { role: 'assistant', content: `API error: ${e?.message ?? e}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  'max-w-[90%] rounded-2xl px-4 py-3 ' +
                  (msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 border border-white/10 text-white')
                }
              >
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                {msg.role === 'assistant' && msg.data && msg.data.decision === 'allow' && (
                  <div className="mt-4 space-y-4">
                    {msg.data.interpretationBullets?.length ? (
                      <Card title="Interpretation">
                        <ul className="list-disc list-inside text-white/90">
                          {msg.data.interpretationBullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </Card>
                    ) : null}
                    {msg.data.topPlaces?.length ? (
                      <Card title="Top places to look">
                        <ul className="space-y-2">
                          {msg.data.topPlaces.map((p, i) => (
                            <li key={i} className="flex flex-col">
                              <span className="font-semibold">{p.name}</span>
                              <a
                                className="text-blue-300 hover:underline text-sm"
                                href={p.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {p.url}
                              </a>
                              <span className="text-sm text-white/70">{p.why}</span>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ) : null}
                    {msg.data.searchQueries?.length ? (
                      <Card title="Suggested searches">
                        <ul className="list-disc list-inside text-white/90">
                          {msg.data.searchQueries.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </Card>
                    ) : null}
                    {msg.data.sources?.length ? (
                      <Card title={`Sources (${msg.data.sources.length})`}>
                        <div className="space-y-3">
                          {msg.data.sources.map((s, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-white/10 bg-black/20 p-3"
                            >
                              <div className="font-semibold">{s.title}</div>
                              <div className="text-sm text-white/60">
                                {s.authors?.length ? s.authors.join(', ') : 'Unknown authors'}
                                {s.year ? ` • ${s.year}` : ''} • {s.host}
                              </div>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-blue-300 hover:underline break-all"
                              >
                                {s.url}
                              </a>
                              {!!s.whyRelevantBullets?.length && (
                                <ul className="mt-2 list-disc list-inside text-sm text-white/85">
                                  {s.whyRelevantBullets.slice(0, 4).map((b, j) => (
                                    <li key={j}>{b}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : null}
                    {msg.data.readingOrder?.length ? (
                      <Card title="Reading order">
                        <ol className="list-decimal list-inside text-white/90">
                          {msg.data.readingOrder.map((title, i) => (
                            <li key={i}>{title}</li>
                          ))}
                        </ol>
                      </Card>
                    ) : null}
                    {msg.data.nextSteps?.length ? (
                      <Card title="Next steps">
                        <ul className="list-disc list-inside text-white/90">
                          {msg.data.nextSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </Card>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl px-4 py-3 bg-white/5 border border-white/10 text-white/70">
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="border-t border-white/10 bg-[#0a0e17] px-4 md:px-8 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder="Message SchoolSafeAI…"
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
                <span>Mode:</span>
                <select
                  value={depth}
                  onChange={(e) => setDepth(e.target.value as 'quick' | 'deep')}
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-white"
                >
                  <option value="quick">Quick</option>
                  <option value="deep">Deep</option>
                </select>
                <span className="ml-auto">Enter to send • Shift+Enter newline</span>
              </div>
            </div>
            <button
              onClick={send}
              disabled={!canSend}
              className="rounded-2xl px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-sm font-semibold text-white/90 mb-2">{title}</div>
      {children}
    </div>
  );
}
