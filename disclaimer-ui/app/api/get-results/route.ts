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

  const res = await fetch(
    `${WORKFRONT_BASE}/issue/${issueId}?fields=name,DE:AI_Review_Result,DE:Differences_Found&apiKey=${apiKey}`
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Workfront fetch failed: ${res.status}` }, { status: res.status });
  }

  const json = await res.json();
  const data = json.data;

  return NextResponse.json({
    issueName: data?.name ?? '',
    aiReviewResult: data?.['DE:AI_Review_Result'] ?? 'No result yet.',
    differencesFound: data?.['DE:Differences_Found'] ?? 'No differences recorded yet.',
  });
}
