import { NextRequest, NextResponse } from 'next/server';

const WORKFRONT_BASE = 'https://comcastcorp.sb01.workfront.com/attask/api/v17.0';

// POST a comment (note) to a Workfront issue as Writer AI reviewer.
// Body: { issueId, noteText, subject? }
// Also supports GET ?issueId=xxx to read existing comments.
export async function POST(req: NextRequest) {
  const { issueId, noteText, subject } = await req.json();

  if (!issueId || !noteText) {
    return NextResponse.json({ error: 'issueId and noteText are required.' }, { status: 400 });
  }

  const apiKey = process.env.WORKFRONT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'WORKFRONT_API_KEY not configured.' }, { status: 500 });
  }

  const res = await fetch(`${WORKFRONT_BASE}/note?apiKey=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      noteObjCode: 'OPTASK',
      objID: issueId,
      noteText,
      subject: subject ?? 'Writer AI Review',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Workfront note POST failed: ${err}` }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ success: true, noteId: data?.data?.ID });
}

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

  const fields = encodeURIComponent('ID,noteText,entryDate,ownerID,subject,parentNoteID');
  const res = await fetch(
    `${WORKFRONT_BASE}/note/search?apiKey=${apiKey}&noteObjCode=OPTASK&objID=${issueId}&fields=${fields}`
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Workfront fetch failed: ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ comments: data?.data ?? [] });
}
