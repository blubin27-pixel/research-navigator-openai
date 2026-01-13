import { NextResponse } from 'next/server';
import { isDisallowed } from '../../../utils/classifier';

interface PlanItem {
  date: string;
  tasks: string[];
}

function generateFallbackPlan(startDate: Date, dueDate: Date): PlanItem[] {
  const tasks = [
    'Define your assignment scope and identify key questions',
    'Research academic sources and gather notes',
    'Organize notes and create a structured outline',
    'Draft your assignment based on the outline',
    'Revise, edit, and finalize your assignment'
  ];
  const results: PlanItem[] = [];
  const totalDays = Math.max(1, Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const step = totalDays / tasks.length;
  for (let i = 0; i < tasks.length; i++) {
    const date = new Date(startDate.getTime());
    date.setDate(startDate.getDate() + Math.round(step * i));
    // Clamp date to dueDate if over
    if (date > dueDate) {
      results.push({ date: dueDate.toISOString().split('T')[0], tasks: [tasks[i]] });
    } else {
      results.push({ date: date.toISOString().split('T')[0], tasks: [tasks[i]] });
    }
  }
  return results;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const topic: string | undefined = body.topic;
    const dueDateStr: string | undefined = body.dueDate;

    if (!topic || !dueDateStr) {
      return NextResponse.json(
        {
          decision: 'refuse',
          refusalReason: 'Please provide both a topic and a due date.',
        },
        { status: 400 },
      );
    }

    if (isDisallowed(topic)) {
      return NextResponse.json({
        decision: 'refuse',
        refusalReason: "I can’t write any part of your assignment, but I can help you plan it.",
      });
    }

    const dueDate = new Date(dueDateStr);
    if (isNaN(dueDate.getTime())) {
      return NextResponse.json(
        {
          decision: 'refuse',
          refusalReason: 'Invalid due date provided.',
        },
        { status: 400 },
      );
    }
    const startDate = new Date();
    // If dueDate is before today, return error
    if (dueDate.getTime() <= startDate.getTime()) {
      return NextResponse.json(
        {
          decision: 'refuse',
          refusalReason: 'The due date must be in the future.',
        },
        { status: 400 },
      );
    }

    const plan = generateFallbackPlan(startDate, dueDate);
    const tips = [
      'Start early and stick to your schedule.',
      'Use credible, peer-reviewed sources and institutional repositories.',
      'Break tasks into manageable chunks and adjust as needed.',
    ];

    return NextResponse.json({
      decision: 'allow',
      plan,
      tips,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        decision: 'refuse',
        refusalReason: 'An error occurred while processing your request.',
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topic = url.searchParams.get('topic') ?? '';
  const dueDate = url.searchParams.get('dueDate') ?? '';
  const fake = new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, dueDate }),
  });
  return POST(fake);
}
