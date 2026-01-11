'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Role = 'user' | 'assistant';

type Source = {
  title: string;
  authors: string[];
  year: number;
  venue?: string;
  doi?: string;
  url: string;
  whyRelevantBullets: string[];
};

type ApiResult =
  | { decision: 'refuse'; refusalReason?: string }
  | {
      decision: 'allow';
      searchQueries?: string[];
      sources?: Source[];
      readingOrder?: string[];
      nextSteps?: string[];
    };

type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; data?: ApiResult };

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [depth, setDepth] = useState<'quick' | 'deep'>('quick');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hi — I'm HistoryGPT. Tell me a topic (even vague/short). I’ll find the best places to look and the most credible sources. I won’t write your paper for you.",
    },
  ]);
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

    setMessages((m) => [...m, { role: 'user', content: userText }]);
    setLoading(true);

    try {
    const res = await fetch('/api/research', {

        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: userText, depth }),
      });
      const data: ApiResult = await res.json();

      if (data.decision === 'refuse') {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content:
              data.refusalReason ??
              "I can’t help write assignment text. I can find sources and a research plan.",
            data,
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: 'Here are the best research directions and sources I found.',
            data,
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: 'Something went wrong fetching sources. Try again in a moment.',
        },
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
    <div className="h-screen flex flex-col">
      {/* Top bar (mobile) */}
      <div className="md:hidden border-b border-white/10 bg-[#0a0e17] px-4 py-3">
        <div className="font-semibold">HistoryGPT</div>
        <div className="text-xs text-white/60">Research-only assistant</div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={[
                  'max-w-[90%] rounded-2xl px-4 py-3',
                  msg.role === 'user'
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-white/5 border border-white/10 text-white',
                ].join(' ')}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                {msg.role === 'assistant' && msg.data && msg.data.decision === 'allow' && (
                  <div className="mt-4 space-y-4">
                    {msg.data.searchQueries?.length ? (
                      <Card title="Suggested searches">
                        <ul className="list-disc list-inside text-white/90">
                          {msg.data.searchQueries.map((q, idx) => (
                            <li key={idx}>{q}</li>
                          ))}
                        </ul>
                      </Card>
                    ) : null}

                    {msg.data.sources?.length ? (
                      <Card title={`Sources (${msg.data.sources.length})`}>
                        <div className="space-y-3">
                          {msg.data.sources.map((s, idx) => (
                            <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <div className="font-semibold">{s.title}</div>
                              <div className="text-sm text-white/60">
                                {s.authors?.length ? s.authors.join(', ') : 'Unknown authors'} • {s.year}
                                {s.venue ? ` • ${s.venue}` : ''}
                              </div>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-blue-300 hover:underline break-all"
                              >
                                {s.doi ?? s.url}
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
                          {msg.data.readingOrder.map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ol>
                      </Card>
                    ) : null}

                    {msg.data.nextSteps?.length ? (
                      <Card title="Next steps">
                        <ul className="list-disc list-inside text-white/90">
                          {msg.data.nextSteps.map((t, idx) => (
                            <li key={idx}>{t}</li>
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

      {/* Composer */}
      <div className="border-t border-white/10 bg-[#0a0e17] px-4 md:px-8 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder="Message HistoryGPT…"
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
