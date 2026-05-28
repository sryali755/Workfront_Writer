import { NextRequest, NextResponse } from 'next/server';

const WRITER_API_URL = 'https://api.writer.com/v1/chat';

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

export async function POST(req: NextRequest) {
  const { baseline, latest, context } = await req.json();

  if (!baseline || !latest) {
    return NextResponse.json({ error: 'Both baseline and latest disclaimer text are required.' }, { status: 400 });
  }

  const userMessage = context
    ? `Compare these two disclaimer versions and return JSON only.\n\nADDITIONAL REFERENCE DOCUMENT:\n${context}\n\nBASELINE (approved version):\n${baseline}\n\nLATEST (version to check):\n${latest}`
    : `Compare these two disclaimer versions and return JSON only.\n\nBASELINE (approved version):\n${baseline}\n\nLATEST (version to check):\n${latest}`;

  const response = await fetch(WRITER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WRITER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'palmyra-x-004',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Writer API error: ${error}` }, { status: response.status });
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const result = JSON.parse(content);

  return NextResponse.json(result);
}
