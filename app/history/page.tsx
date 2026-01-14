'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Types for the AI response

type Source = {
  title: string;
  url: string;
  host: string;
  year?: number;
  authors?: string[];
  whyRelevantBullets: string[];
};

type Theme = {
  theme: string;
  whyThisThemeMatters: string;
  sources: Source[];
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
      overview: string;
      interpretationBullets: string[];
      topPlaces: TopPlace[];
      themes: Theme[];
      nextSteps: string[];
    };

// Message type for the chat UI

type Msg = { role: 'user' | 'assistant'; content: string; data?: ApiResult };

// Main history chat component
export default function HistoryChat() {
  const [input, setInput] = useState('');
  const [depth, setDepth] = useState<'quick' | 'deep'>('quick');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        "SchoolSafeAI (History). Tell me a topic—even vague or misspelled—and I’ll return an overview + the best free academic PDFs (prioritizing .edu) without writing your paper.",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function send() {
    if (!canSend) return;
    const userText = input.trim();
    setInput('');
    const nextMessages: Msg[] = [...messages, { role: 'user', content: userText }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depth,
          messages: nextMessages
            .map((m) => ({ role: m.role, content: m.content }))
            .slice(-12),
        }),
      });

      const raw = await res.text();
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`);
      const data: ApiResult = JSON.parse(raw);

      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            data.decision === 'allow'
              ? "Here’s a research overview and free PDF sources."
              : data.refusalReason,
          data,
        },
      ]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `API error: ${e?.message ?? 'unknown'}` },
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
    <div className="h-screen flex flex-col bg-[#0b0f19] text-white">
      {/* Chat thread */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={[
                  'max-w-[90%] rounded-2xl px-4 py-3',
                  msg.role === 'user'
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-white/5 border border-white/10 text-white',
                ].join(' ')}
              >
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>

                {msg.role === 'assistant' &&
                  msg.data &&
                  msg.data.decision === 'allow' && (
                    <div className="mt-4 space-y-4">
                      <Card title="Overview">
                        <p className="text-white/90">{msg.data.overview}</p>
                        {msg.data.interpretationBullets?.length ? (
                          <ul className="mt-3 list-disc list-inside text-white/85 text-sm space-y-1">
                            {msg.data.interpretationBullets.map((b, idx) => (
                              <li key={idx}>{b}</li>
                            ))}
                          </ul>
                        ) : null}
                      </Card>

                      <Card title="Where to look (free)">
                        <div className="grid gap-3">
                          {msg.data.topPlaces.map((p, idx) => (
                            <a
                              key={idx}
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl border border-white/10 bg-black/20 p-3 hover:bg-black/30 transition"
                            >
                              <div className="font-semibold">{p.name}</div>
                              <div className="text-xs text-white/60 break-all">{p.url}</div>
                              <div className="text-sm text-white/85 mt-1">{p.why}</div>
                            </a>
                          ))}
                        </div>
                      </Card>

                      <Card title="Sources by theme (PDFs)">
                        <div className="space-y-5">
                          {msg.data.themes.map((t, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl border border-white/10 bg-black/20 p-4"
                            >
                              <div className="text-lg font-semibold">{t.theme}</div>
                              <div className="text-sm text-white/80 mt-1">
                                {t.whyThisThemeMatters}
                              </div>

                              <div className="mt-3 space-y-3">
                                {t.sources.map((s, j) => (
                                  <div
                                    key={j}
                                    className="rounded-xl border border-white/10 bg-black/30 p-3"
                                  >
                                    <div className="font-semibold">{s.title}</div>
                                    <div className="text-xs text-white/60">
                                      {s.authors?.length
                                        ? s.authors.join(', ')
                                        : 'Unknown authors'}
                                      {typeof s.year === 'number' ? ` • ${s.year}` : ''}
                                      {' \u2022 '}
                                      {s.host}
                                    </div>
                                    <a
                                      href={s.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-sm text-blue-300 hover:underline break-all"
                                    >
                                      PDF
                                    </a>
                                    <ul className="mt-2 list-disc list-inside text-sm text-white/85 space-y-1">
                                      {s.whyRelevantBullets.slice(0, 4).map((b, k) => (
                                        <li key={k}>{b}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>

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
                placeholder="Ask a history research question…"
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
                <span>Mode:</span>
                <select
                  value={depth}
                  onChange={(e) =>
                    setDepth(e.target.value as 'quick' | 'deep')
                  }
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-white"
                >
                  <option value="quick">Quick</option>
                  <option value="deep">Deep</option>
                </select>
                <span className="ml-auto">
                  Enter to send • Shift+Enter newline
                </span>
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
      <div className="text-sm font-semibold text-white/90 mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}
