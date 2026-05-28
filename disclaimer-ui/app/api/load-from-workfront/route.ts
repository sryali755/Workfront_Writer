import { NextRequest, NextResponse } from 'next/server';

const WORKFRONT_BASE = 'https://comcastcorp.sb01.workfront.com/attask/api/v17.0';

export async function POST(req: NextRequest) {
  const { issueId } = await req.json();

  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required.' }, { status: 400 });
  }

  const apiKey = process.env.WORKFRONT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'WORKFRONT_API_KEY is not configured on the server.' }, { status: 500 });
  }

  const fields = encodeURIComponent('ID,name,DE:Baseline Disclaimer v2,DE:Latest Disclaimer v2');
  const response = await fetch(
    `${WORKFRONT_BASE}/issue/${issueId}?fields=${fields}&apiKey=${apiKey}`
  );

  if (!response.ok) {
    return NextResponse.json({ error: `Workfront returned ${response.status}. Check the issue ID.` }, { status: response.status });
  }

  const data = await response.json();
  const issue = data.data;

  if (!issue) {
    return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
  }

  return NextResponse.json({
    name: issue.name ?? 'Untitled Issue',
    baseline: issue['DE:Baseline Disclaimer v2'] ?? '',
    latest: issue['DE:Latest Disclaimer v2'] ?? '',
  });
}
