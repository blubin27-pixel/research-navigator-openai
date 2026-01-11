import { NextResponse } from 'next/server';
import { searchOpenAlex } from '../../../utils/openAlex';
import { searchCrossref } from '../../../utils/crossref';
import { searchUnpaywall } from '../../../utils/unpaywall';
import { isDisallowed } from '../../../utils/classifier';

// For query expansion using OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

async function generateSearchQueries(topic: string): Promise<string[]> {
  const baseQuery = topic.trim();
  // fallback baseline queries
  const baseline = [
    baseQuery,
    `${baseQuery} review article`,
    `${baseQuery} historiography`,
  ];
  if (!OPENAI_API_KEY) return baseline;
  try {
    const prompt = `You are a research assistant. Given a topic, produce a list of up to 10 concise search queries that students can use to find scholarly sources. Do not include prefixes like "search for" or "query:". Topic: "${topic}"`;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful research assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 200,
        n: 1,
        stop: null,
      }),
    });
    if (!res.ok) throw new Error('OpenAI API error');
    const data = await res.json();
    const message = data.choices?.[0]?.message?.content || '';
    // assume queries separated by newline or semicolon
    const queries = message.split(/\n|;/).map((s) => s.trim()).filter(Boolean);
    return queries.length > 0 ? queries : baseline;
  } catch (err) {
    console.error('Error generating queries via OpenAI', err);
    return baseline;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const topic = body.topic as string | undefined;
    const depth = (body.depth as 'quick' | 'deep') || 'quick';
    if (!topic || typeof topic !== 'string') {
      return NextResponse.json(
        { decision: 'refuse', refusalReason: 'A valid topic must be provided.' },
        { status: 400 },
      );
    }

    // disallow essay writing
    if (isDisallowed(topic)) {
      return NextResponse.json({
        decision: 'refuse',
        refusalReason:
          'I can’t write content that could be submitted as your assignment. I can help you find sources and build a research plan.',
      });
    }

    const searchQueries = await generateSearchQueries(topic);

    const maxResults = depth === 'deep' ? 50 : 20;

    const openAlexWorks = await searchOpenAlex(topic, maxResults);
    let crossrefWorks: any[] = [];
    try {
      crossrefWorks = await searchCrossref(topic, maxResults);
    } catch (err) {
      console.error('Error fetching Crossref results', err);
    }
    let unpaywallWorks: any[] = [];
    const unpaywallEmail = process.env.UNPAYWALL_EMAIL;
    if (unpaywallEmail) {
      try {
        unpaywallWorks = await searchUnpaywall(topic, unpaywallEmail, maxResults);
      } catch (err) {
        console.error('Error fetching Unpaywall results', err);
      }
    }

    const mergedMap: Record<
      string,
      {
        title: string;
        authors: string[];
        year: number;
        venue?: string;
        doi?: string;
        url?: string;
        whyRelevantBullets: string[];
      }
    > = {};

    const upsertEntry = (
      key: string,
      update: {
        title?: string;
        authors?: string[];
        year?: number;
        venue?: string;
        doi?: string;
        url?: string;
        whyRelevantBullets?: string[];
      },
    ) => {
      const existing =
        mergedMap[key] ??
        ({
          title: update.title ?? '',
          authors: update.authors ?? [],
          year: update.year ?? 0,
          venue: update.venue,
          doi: update.doi,
          url: update.url,
          whyRelevantBullets: [],
        } as {
          title: string;
          authors: string[];
          year: number;
          venue?: string;
          doi?: string;
          url?: string;
          whyRelevantBullets: string[];
        });

      if (!existing.title && update.title) existing.title = update.title;
      if (existing.authors.length === 0 && update.authors) existing.authors = update.authors;
      if ((!existing.year || existing.year === 0) && update.year) existing.year = update.year;
      if (!existing.venue && update.venue) existing.venue = update.venue;
      if (!existing.doi && update.doi) existing.doi = update.doi;
      if (!existing.url && update.url) existing.url = update.url;
      if (update.whyRelevantBullets) {
        for (const bullet of update.whyRelevantBullets) {
          if (!existing.whyRelevantBullets.includes(bullet)) {
            existing.whyRelevantBullets.push(bullet);
          }
        }
      }
      mergedMap[key] = existing;
    };

    // format authors
    const formatAuthors = (authors: string[]) => {
      return authors && authors.length > 0 ? authors.join(', ') : 'Unknown authors';
    };

    // Merge openAlex results
    for (const work of openAlexWorks) {
      const key = work.doi ? work.doi.toLowerCase() : work.id;
      upsertEntry(key, {
        title: work.title,
        authors: work.authors,
        year: work.publication_year,
        venue: work.host_venue,
        doi: work.doi,
        url: work.doi ? `https://doi.org/${work.doi.replace(/^doi:/, '')}` : work.id,
        whyRelevantBullets: [
          `Published in ${work.host_venue ?? 'an unknown venue'} in ${work.publication_year}`,
          `Authored by ${formatAuthors(work.authors)}`,
          `Has ${work.cited_by_count} citations on OpenAlex`,
        ],
      });
    }

    // Merge crossref results
    for (const work of crossrefWorks) {
      const key = work.doi ? work.doi.toLowerCase() : work.title;
      upsertEntry(key, {
        title: work.title,
        authors: work.authors,
        year: work.year,
        venue: work.venue,
        doi: work.doi,
        url: work.url,
        whyRelevantBullets: [
          'Recorded in Crossref metadata',
          work.cited_by_count !== undefined
            ? `Referenced by ${work.cited_by_count} works in Crossref`
            : '',
        ].filter(Boolean),
      });
    }

    // merge unpaywall results
    for (const work of unpaywallWorks) {
      const key = work.doi ? work.doi.toLowerCase() : work.title;
      upsertEntry(key, {
        title: work.title,
        authors: work.authors,
        year: work.year,
        venue: work.venue,
        doi: work.doi,
        url: work.url,
        whyRelevantBullets: ['Open access via Unpaywall'],
      });
    }

    let mergedList = Object.values(mergedMap);
    mergedList = mergedList
      .filter((s) => s.title && s.authors)
      .sort((a, b) => {
        if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
        return (b.whyRelevantBullets.length || 0) - (a.whyRelevantBullets.length || 0);
      });

    const sources = mergedList.slice(0, maxResults);
    const readingOrder = sources.slice(0, Math.min(5, sources.length)).map((s) => s.title);
    const nextSteps = [
      'Visit your school library portal and log in.',
      'Copy and paste the suggested search queries into JSTOR or other academic databases.',
      'Take notes on key arguments, evidence, and historiographical debates.',
    ];

import { NextResponse } from 'next/server';
import { searchOpenAlex } from '../../../utils/openAlex';
import { searchCrossref } from '../../../utils/crossref';
import { searchUnpaywall } from '../../../utils/unpaywall';
import { isDisallowed } from '../../../utils/classifier';

// For query expansion using OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

async function generateSearchQueries(topic: string): Promise<string[]> {
  const baseQuery = topic.trim();
  // fallback baseline queries
  const baseline = [
    baseQuery,
    `${baseQuery} review article`,
    `${baseQuery} historiography`,
  ];
  if (!OPENAI_API_KEY) return baseline;
  try {
    const prompt = `You are a research assistant. Given a topic, produce a list of up to 10 concise search queries that students can use to find scholarly sources. Do not include prefixes like "search for" or "query:". Topic: "${topic}"`;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful research assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 200,
        n: 1,
        stop: null,
      }),
    });
    if (!res.ok) throw new Error('OpenAI API error');
    const data = await res.json();
    const message = data.choices?.[0]?.message?.content || '';
    // assume queries separated by newline or semicolon
    const queries = message.split(/\n|;/).map((s) => s.trim()).filter(Boolean);
    return queries.length > 0 ? queries : baseline;
  } catch (err) {
    console.error('Error generating queries via OpenAI', err);
    return baseline;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const topic = body.topic as string | undefined;
    const depth = (body.depth as 'quick' | 'deep') || 'quick';
    if (!topic || typeof topic !== 'string') {
      return NextResponse.json(
        { decision: 'refuse', refusalReason: 'A valid topic must be provided.' },
        { status: 400 },
      );
    }

    // disallow essay writing
    if (isDisallowed(topic)) {
      return NextResponse.json({
        decision: 'refuse',
        refusalReason:
          'I can’t write content that could be submitted as your assignment. I can help you find sources and build a research plan.',
      });
    }

    const searchQueries = await generateSearchQueries(topic);

    const maxResults = depth === 'deep' ? 50 : 20;

    const openAlexWorks = await searchOpenAlex(topic, maxResults);
    let crossrefWorks: any[] = [];
    try {
      crossrefWorks = await searchCrossref(topic, maxResults);
    } catch (err) {
      console.error('Error fetching Crossref results', err);
    }
    let unpaywallWorks: any[] = [];
    const unpaywallEmail = process.env.UNPAYWALL_EMAIL;
    if (unpaywallEmail) {
      try {
        unpaywallWorks = await searchUnpaywall(topic, unpaywallEmail, maxResults);
      } catch (err) {
        console.error('Error fetching Unpaywall results', err);
      }
    }

    const mergedMap: Record<
      string,
      {
        title: string;
        authors: string[];
        year: number;
        venue?: string;
        doi?: string;
        url?: string;
        whyRelevantBullets: string[];
      }
    > = {};

    const upsertEntry = (
      key: string,
      update: {
        title?: string;
        authors?: string[];
        year?: number;
        venue?: string;
        doi?: string;
        url?: string;
        whyRelevantBullets?: string[];
      },
    ) => {
      const existing =
        mergedMap[key] ??
        ({
          title: update.title ?? '',
          authors: update.authors ?? [],
          year: update.year ?? 0,
          venue: update.venue,
          doi: update.doi,
          url: update.url,
          whyRelevantBullets: [],
        } as {
          title: string;
          authors: string[];
          year: number;
          venue?: string;
          doi?: string;
          url?: string;
          whyRelevantBullets: string[];
        });

      if (!existing.title && update.title) existing.title = update.title;
      if (existing.authors.length === 0 && update.authors) existing.authors = update.authors;
      if ((!existing.year || existing.year === 0) && update.year) existing.year = update.year;
      if (!existing.venue && update.venue) existing.venue = update.venue;
      if (!existing.doi && update.doi) existing.doi = update.doi;
      if (!existing.url && update.url) existing.url = update.url;
      if (update.whyRelevantBullets) {
        for (const bullet of update.whyRelevantBullets) {
          if (!existing.whyRelevantBullets.includes(bullet)) {
            existing.whyRelevantBullets.push(bullet);
          }
        }
      }
      mergedMap[key] = existing;
    };

    // format authors
    const formatAuthors = (authors: string[]) => {
      return authors && authors.length > 0 ? authors.join(', ') : 'Unknown authors';
    };

    // Merge openAlex results
    for (const work of openAlexWorks) {
      const key = work.doi ? work.doi.toLowerCase() : work.id;
      upsertEntry(key, {
        title: work.title,
        authors: work.authors,
        year: work.publication_year,
        venue: work.host_venue,
        doi: work.doi,
        url: work.doi ? `https://doi.org/${work.doi.replace(/^doi:/, '')}` : work.id,
        whyRelevantBullets: [
          `Published in ${work.host_venue ?? 'an unknown venue'} in ${work.publication_year}`,
          `Authored by ${formatAuthors(work.authors)}`,
          `Has ${work.cited_by_count} citations on OpenAlex`,
        ],
      });
    }

    // Merge crossref results
    for (const work of crossrefWorks) {
      const key = work.doi ? work.doi.toLowerCase() : work.title;
      upsertEntry(key, {
        title: work.title,
        authors: work.authors,
        year: work.year,
        venue: work.venue,
        doi: work.doi,
        url: work.url,
        whyRelevantBullets: [
          'Recorded in Crossref metadata',
          work.cited_by_count !== undefined
            ? `Referenced by ${work.cited_by_count} works in Crossref`
            : '',
        ].filter(Boolean),
      });
    }

    // merge unpaywall results
    for (const work of unpaywallWorks) {
      const key = work.doi ? work.doi.toLowerCase() : work.title;
      upsertEntry(key, {
        title: work.title,
        authors: work.authors,
        year: work.year,
        venue: work.venue,
        doi: work.doi,
        url: work.url,
        whyRelevantBullets: ['Open access via Unpaywall'],
      });
    }

    let mergedList = Object.values(mergedMap);
    mergedList = mergedList
      .filter((s) => s.title && s.authors)
      .sort((a, b) => {
        if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
        return (b.whyRelevantBullets.length || 0) - (a.whyRelevantBullets.length || 0);
      });

    const sources = mergedList.slice(0, maxResults);
    const readingOrder = sources.slice(0, Math.min(5, sources.length)).map((s) => s.title);
    const nextSteps = [
      'Visit your school library portal and log in.',
      'Copy and paste the suggested search queries into JSTOR or other academic databases.',
      'Take notes on key arguments, evidence, and historiographical debates.',
    ];

    return NextResponse.json({
      decision: 'allow',
      searchQueries,
      sources,
      readingOrder,
      nextSteps,
    });
  } catch (error) {
    console.error('Error in history route', error);
    return NextResponse.json(
      { decision: 'refuse', refusalReason: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}

// Provide GET support
export async function GET(req: Request) {
  const url = new URL(req.url);
  const topic = url.searchParams.get('topic');
  const depth = (url.searchParams.get('depth') as 'quick' | 'deep') || 'quick';
  const body = JSON.stringify({ topic, depth });
  const fakeReq = new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return POST(fakeReq);
}
    return NextResponse.json({
      decision: 'allow',
      searchQueries,
      sources,
      readingOrder,
      nextSteps,
    });
  } catch (error) {
    console.error('Error in history route', error);
    return NextResponse.json(
      { decision: 'refuse', refusalReason: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}

// Provide GET support
export async function GET(req: Request) {
  const url = new URL(req.url);
  const topic = url.searchParams.get('topic');
  const depth = (url.searchParams.get('depth') as 'quick' | 'deep') || 'quick';
  const body = JSON.stringify({ topic, depth });
  const fakeReq = new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return POST(fakeReq);
}
