import { NextRequest, NextResponse } from 'next/server';

const WORKFRONT_BASE = 'https://comcastcorp.sb01.workfront.com/attask/api/v17.0';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const issueId = searchParams.get('issueId');

  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required.' }, { status: 400 });
  }

  const apiKey = process.env.WORKFRONT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'WORKFRONT_API_KEY not configured.' }, { status: 500 });
  }

  const fields = encodeURIComponent('name,DE:AI Review Result v2,DE:Differences Found v2');
  const res = await fetch(
    `${WORKFRONT_BASE}/issue/${issueId}?fields=${fields}&apiKey=${apiKey}`
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Workfront fetch failed: ${res.status}` }, { status: res.status });
  }

  const json = await res.json();
  const data = json.data;

  return NextResponse.json({
    issueName: data?.name ?? '',
    aiReviewResult: data?.['DE:AI Review Result v2'] ?? 'No result yet.',
    differencesFound: data?.['DE:Differences Found v2'] ?? 'No differences recorded yet.',
  });
}
