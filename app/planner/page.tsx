'use client';

import { useState } from 'react';

interface PlanItem {
  date: string;
  tasks: string[];
}

interface AllowPlan {
  decision: 'allow';
  plan: PlanItem[];
  tips?: string[];
}

interface RefusePlan {
  decision: 'refuse';
  refusalReason: string;
}

type PlannerResponse = AllowPlan | RefusePlan;

export default function PlannerPage() {
  const [topic, setTopic] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlannerResponse | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!topic || !dueDate) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, dueDate }),
      });
      const data: PlannerResponse = await res.json();
      setResult(data);
    } catch {
      setResult({ decision: 'refuse', refusalReason: 'Error generating plan. Please try again later.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 mx-auto max-w-3xl text-white">
      <h1 className="text-3xl font-bold mb-4">Create a Research Plan</h1>
      <p className="text-white/80 mb-6 max-w-2xl">
        Enter your assignment topic and due date, and I’ll help you break the work into manageable steps.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            placeholder="e.g. French Revolution historiography"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate plan'}
        </button>
      </form>
      {result && result.decision === 'allow' && (
        <div className="mt-8 space-y-4">
          <h2 className="text-2xl font-semibold">Your Plan</h2>
          <ul className="space-y-3">
            {result.plan.map((item, idx) => (
              <li key={idx} className="border border-white/10 rounded-xl p-4">
                <div className="font-semibold mb-1">{item.date}</div>
                <ul className="list-disc list-inside text-sm text-white/90 ml-4">
                  {item.tasks.map((task, j) => (
                    <li key={j}>{task}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {result.tips && result.tips.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mt-4">Tips</h3>
              <ul className="list-disc list-inside text-sm text-white/90 ml-4">
                {result.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {result && result.decision === 'refuse' && (
        <div className="mt-6 text-yellow-400">{result.refusalReason}</div>
      )}
    </div>
  );
}
