import { NextResponse } from "next/server";
import { isDisallowed } from "../../../utils/classifier";

type Depth = "quick" | "deep";
type ChatMsg = { role: "user" | "assistant"; content: string };

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

type TopPlace = { name: string; url: string; why: string };

type Allow = {
  decision: "allow";
  overview: string;
  interpretationBullets: string[];
  topPlaces: TopPlace[];
  themes: Theme[];
  nextSteps: string[];
};

type Refuse = { decision: "refuse"; refusalReason: string };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const ALLOWED_HOSTS: RegExp[] = [
  /\.edu$/i,
  /arxiv\.org$/i,
  /osf\.io$/i,
  /zenodo\.org$/i,
  /core\.ac\.uk$/i,
  /semanticscholar\.org$/i,
  /escholarship\.org$/i,
  /dash\.harvard\.edu$/i,
  /stacks\.stanford\.edu$/i,
  /yalebooks\.yale\.edu$/i,
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isPdf(url: string): boolean {
  const u = url.toLowerCase();
  return u.endsWith(".pdf") || u.includes(".pdf?") || u.includes("/pdf");
}

function isAllowedPdf(url: string): boolean {
  if (!isPdf(url)) return false;
  const host = hostOf(url);
  if (!host) return false;
  return ALLOWED_HOSTS.some((re) => re.test(host));
}

function dedupeByUrl<T extends { url: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = (x.url || "").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function compactContext(topic?: string, messages?: ChatMsg[]): string {
  if (topic?.trim()) return topic.trim();
  if (!messages?.length) return "";
  return messages
    .filter((m) => m.role === "user")
    .slice(-6)
    .map((m) => m.content)
    .join("\n");
}

async function callOpenAI(userContext: string, depth: Depth): Promise<Allow | Refuse> {
  if (!OPENAI_API_KEY) {
    return {
      decision: "refuse",
      refusalReason: "Server missing OPENAI_API_KEY.",
    };
  }

  const maxThemes = depth === "deep" ? 4 : 3;
  const maxSourcesPerTheme = depth === "deep" ? 6 : 4;

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      decision: { type: "string", enum: ["allow", "refuse"] },
      refusalReason: { type: "string" },
      overview: { type: "string" },
      interpretationBullets: { type: "array", items: { type: "string" } },
      topPlaces: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            url: { type: "string" },
            why: { type: "string" },
          },
          required: ["name", "url", "why"],
        },
      },
      themes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            theme: { type: "string" },
            whyThisThemeMatters: { type: "string" },
            sources: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  url: { type: "string" },
                  host: { type: "string" },
                  year: { type: "number" },
                  authors: { type: "array", items: { type: "string" } },
                  whyRelevantBullets: { type: "array", items: { type: "string" } },
                },
                required: ["title", "url", "host", "whyRelevantBullets"],
              },
            },
          },
          required: ["theme", "whyThisThemeMatters", "sources"],
        },
      },
      nextSteps: { type: "array", items: { type: "string" } },
    },
    required: ["decision"],
  } as const;

  const system = `
You are SchoolSafeAI History mode: a ChatGPT-level RESEARCH AGENT (not a keyword search).
Hard rules:
- Do NOT write any paper text (no intro, thesis, body, conclusion, or “here’s a paragraph”).
- If user asks for writing, respond: decision="refuse" with a brief refusalReason.

Goal:
Understand the user’s intent (even vague/misspelled), then use web search to find ONLY FREE, HIGH-CREDIBILITY ACADEMIC PDF SOURCES.
Absolute constraints:
- ONLY direct PDF links.
- Strongly prefer .edu PDFs (course readers, working papers, lecture notes, institutional repos).
- Also allow reputable open repositories (arXiv, OSF, Zenodo, CORE, etc.) if needed.
- NO books for purchase. NO paywalled publishers. NO JSTOR links unless it is a free PDF mirror (must be direct .pdf).
- No “Crossref metadata” talk. Keep the output clean.

Output format (JSON):
- overview (short paragraph)
- interpretationBullets (2–6 bullets showing you understood)
- topPlaces: exactly 5 best free places to look for THIS topic (URLs + why)
- themes: ${maxThemes} themes max, each with up to ${maxSourcesPerTheme} sources (direct PDFs only)
- nextSteps (practical research steps)
`.trim();

  const user = `
User prompt/context:
${userContext}

Return: overview first, then 5 “where to look” sites, then themes with sources grouped under each theme.
Remember: ONLY direct PDF links from free academic sources.
`.trim();

  const body = {
    model: OPENAI_MODEL,
    tools: [{ type: "web_search_preview" }],
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_output_tokens: 1600,
    text: {
      format: {
        type: "json_schema",
        strict: true,
        schema,
      },
    },
  };

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await r.text();
  if (!r.ok) {
    return { decision: "refuse", refusalReason: `OpenAI error ${r.status}: ${raw.slice(0, 220)}` };
  }

  let parsed: any;
  try {
    const data = JSON.parse(raw);
    const txt = data.output_text ?? "";
    parsed = JSON.parse(txt);
  } catch {
    return { decision: "refuse", refusalReason: "Could not parse model output." };
  }

  if (parsed.decision !== "allow") return parsed as Refuse;

  for (const t of parsed.themes ?? []) {
    t.sources = dedupeByUrl(t.sources || [])
      .map((s: any) => ({ ...s, host: s.host || hostOf(s.url || "") }))
      .filter((s: any) => typeof s.url === "string" && isAllowedPdf(s.url))
      .slice(0, maxSourcesPerTheme);
  }

  parsed.themes = (parsed.themes || [])
    .filter((t: any) => Array.isArray(t.sources) && t.sources.length > 0)
    .slice(0, maxThemes);

  if (!parsed.themes.length) {
    parsed.nextSteps = [
      "Try adding a more specific angle + time range (e.g., 'Napoleonic Code civil liberties 1804–1815').",
      "Ask for 'university lecture notes PDF' or 'working paper PDF' in your prompt.",
      "Switch to deep mode and re-run.",
    ];
  }

  return parsed as Allow;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const depth: Depth = body.depth === "deep" ? "deep" : "quick";
    const topic: string | undefined = body.topic;
    const messages: ChatMsg[] | undefined = body.messages;

    const userContext = compactContext(topic, messages);
    if (!userContext) {
      return NextResponse.json({ decision: "refuse", refusalReason: "Enter a topic." }, { status: 400 });
    }

    if (isDisallowed(userContext)) {
      return NextResponse.json({
        decision: "refuse",
        refusalReason:
          "I can’t write any part of your paper. I can help you find free academic PDFs and a research plan.",
      });
    }

    const out = await callOpenAI(userContext, depth);
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { decision: "refuse", refusalReason: `Server error: ${e?.message ?? "unknown"}` },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") || "";
  const depth = (url.searchParams.get("depth") as Depth) || "quick";
  const fake = new Request(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, depth }),
  });
  return POST(fake);
}
