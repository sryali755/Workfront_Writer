import { NextRequest, NextResponse } from 'next/server';

const WORKFRONT_BASE = 'https://comcastcorp.sb01.workfront.com/attask/api/v17.0';

export async function POST(req: NextRequest) {
  const { issueId, aiReviewResult, differencesFound } = await req.json();

  if (!issueId || !aiReviewResult) {
    return NextResponse.json({ error: 'issueId and aiReviewResult are required.' }, { status: 400 });
  }

  const apiKey = process.env.WORKFRONT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'WORKFRONT_API_KEY is not configured on the server.' }, { status: 500 });
  }

  const response = await fetch(`${WORKFRONT_BASE}/issue/${issueId}?apiKey=${apiKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'DE:AI Review Result v2': aiReviewResult,
      'DE:Differences Found v2': differencesFound ?? 'No differences found.',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Workfront update failed: ${error}` }, { status: response.status });
  }

  return NextResponse.json({ success: true });
}
