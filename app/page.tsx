'use client';
import { useState } from 'react';

interface Source {
  title: string;
  authors: string[];
  year: number;
  venue?: string;
  doi?: string;
  url: string;
  whyRelevantBullets: string[];
}

interface Result {
  decision: 'allow' | 'refuse';
  refusalReason?: string;
  searchQueries?: string[];
  sources?: Source[];
  readingOrder?: string[];
  nextSteps?: string[];
}

export default function Page() {
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<'quick' | 'deep'>('quick');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, depth }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError('Failed to fetch results. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-3xl font-bold mb-4">Research Navigator</h1>
      <div className="mb-4">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter your research topic..."
          className="w-full p-2 border rounded mb-2"
        />
        <select
          value={depth}
          onChange={(e) => setDepth(e.target.value as 'quick' | 'deep')}
          className="p-2 border rounded mr-2"
        >
          <option value="quick">Quick (10 sources)</option>
          <option value="deep">Deep (20 sources)</option>
        </select>
        <button
          onClick={submit}
          disabled={loading}
          className="p-2 bg-blue-600 text-white rounded"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {result && result.decision === 'refuse' && (
        <div className="p-4 border bg-yellow-100 rounded">
          <p className="font-semibold">Request Refused</p>
          <p>{result.refusalReason}</p>
        </div>
      )}
      {result && result.decision === 'allow' && (
        <div>
          {result.searchQueries && (
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Suggested Search Queries</h2>
              <ul className="list-disc list-inside">
                {result.searchQueries.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {result.sources && (
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Sources</h2>
              <div className="space-y-4">
                {result.sources.map((src, idx) => (
                  <div key={idx} className="p-4 border rounded bg-white">
                    <h3 className="font-semibold">{src.title}</h3>
                    <p className="text-sm text-gray-600">
                      {src.authors.join(', ')} ({src.year})
                      {src.venue ? ` – ${src.venue}` : ''}
                    </p>
                    <a
                      href={src.url}
                      target="_blank"
                      className="text-blue-600 underline"
                      rel="noopener noreferrer"
                    >
                      {src.doi ?? 'Link'}
                    </a>
                    <ul className="list-disc list-inside mt-2">
                      {src.whyRelevantBullets.map((point, j) => (
                        <li key={j}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.readingOrder && (
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Reading Order</h2>
              <ol className="list-decimal list-inside">
                {result.readingOrder.map((title, idx) => (
                  <li key={idx}>{title}</li>
                ))}
              </ol>
            </div>
          )}
          {result.nextSteps && (
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Next Steps</h2>
              <ul className="list-disc list-inside">
                {result.nextSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
