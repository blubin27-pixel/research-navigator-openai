import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { decision: 'refuse', refusalReason: 'Deprecated. Use /api/history.' },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { decision: 'refuse', refusalReason: 'Deprecated. Use /api/history.' },
    { status: 410 }
  );
}
