import { NextRequest, NextResponse } from 'next/server';

const WRITER_API_URL = 'https://api.writer.com/v1/chat';
const WORKFRONT_BASE = 'https://comcastcorp.sb01.workfront.com/attask/api/v17.0';

const SYSTEM_PROMPT = `You are a legal disclaimer quality control assistant for an editorial team.

Your ONLY job is to compare two disclaimer texts and identify differences.

Rules:
- Do NOT rewrite or suggest new disclaimer language
- Do NOT make legal judgments
- ONLY identify what changed between the baseline and the latest version
- Be precise: flag missing words, changed words, punctuation changes, removed sentences

Output format (always return valid JSON):
{
  "status": "MATCH" or "MISMATCH",
  "summary": "One sentence summary of findings",
  "differences": [
    {
      "type": "changed" | "missing" | "added" | "punctuation",
      "baseline_text": "exact text from baseline",
      "latest_text": "exact text from latest (or null if missing)",
      "description": "plain English description of the issue"
    }
  ]
}`;

// Called by Fusion's HTTP module.
// Fusion sends: { ID, baseline, latest }  (fields extracted from the Watch Event payload)
// If baseline/latest are missing, we fetch them from Workfront using the ID.
// Returns: { aiReviewResult, differencesFound }
// Fusion's Update Record module maps these two fields back into Workfront.
export async function POST(req: NextRequest) {
  const body = await req.json();

  let baseline: string = body.baseline ?? body['DE:Baseline_Disclaimer'] ?? '';
  let latest: string   = body.latest   ?? body['DE:Latest_Disclaimer']   ?? '';
  const issueId: string = body.ID ?? body.issueId ?? '';

  // Fallback: fetch fields from Workfront if not provided in the payload
  if ((!baseline || !latest) && issueId) {
    const apiKey = process.env.WORKFRONT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'WORKFRONT_API_KEY not configured.' }, { status: 500 });
    }
    const wfRes = await fetch(
      `${WORKFRONT_BASE}/issue/${issueId}?fields=DE:Baseline_Disclaimer,DE:Latest_Disclaimer&apiKey=${apiKey}`
    );
    if (!wfRes.ok) {
      return NextResponse.json({ error: `Workfront fetch failed: ${wfRes.status}` }, { status: wfRes.status });
    }
    const wfData = await wfRes.json();
    baseline = wfData.data?.['DE:Baseline_Disclaimer'] ?? '';
    latest   = wfData.data?.['DE:Latest_Disclaimer']   ?? '';
  }

  if (!baseline || !latest) {
    return NextResponse.json(
      { error: 'Missing baseline or latest disclaimer. Send them in the body or provide a valid issue ID.' },
      { status: 400 }
    );
  }

  // Call Writer AI
  const writerRes = await fetch(WRITER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WRITER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'palmyra-x-004',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Compare these two disclaimer versions and return JSON only.\n\nBASELINE (approved version):\n${baseline}\n\nLATEST (version to check):\n${latest}`
        }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })
  });

  if (!writerRes.ok) {
    const err = await writerRes.text();
    return NextResponse.json({ error: `Writer API error: ${err}` }, { status: writerRes.status });
  }

  const writerData = await writerRes.json();
  const result = JSON.parse(writerData.choices[0].message.content);

  // Format into strings that Fusion maps directly into Workfront Update Record fields
  const aiReviewResult = result.status === 'MATCH'
    ? `PASS — ${result.summary}`
    : `FAIL — ${result.summary}`;

  const differencesFound = result.differences.length === 0
    ? 'No differences found.'
    : result.differences
        .map((d: { type: string; description: string; baseline_text: string; latest_text: string | null }, i: number) =>
          `${i + 1}. [${d.type.toUpperCase()}] ${d.description}\n   Baseline: "${d.baseline_text}"\n   Latest:   "${d.latest_text ?? 'MISSING'}"`
        )
        .join('\n\n');

  // Return to Fusion — Fusion's Update Record module maps these back to Workfront
  return NextResponse.json({
    success: true,
    issueId,
    aiReviewResult,
    differencesFound,
  });
}
