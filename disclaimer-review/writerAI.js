import fetch from 'node-fetch';

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

export async function compareDisclaimers(baselineDisclaimer, latestDisclaimer, apiKey) {
  const response = await fetch(WRITER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'palmyra-x-004',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Compare these two disclaimer versions and return JSON only.

BASELINE (approved version):
${baselineDisclaimer}

LATEST (version to check):
${latestDisclaimer}`
        }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Writer AI API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content);
}

export function formatResultForWorkfront(result) {
  const aiReviewResult = result.status === 'MATCH'
    ? `✅ PASS — ${result.summary}`
    : `❌ FAIL — ${result.summary}`;

  const differencesFound = result.differences.length === 0
    ? 'No differences found.'
    : result.differences.map((d, i) =>
        `${i + 1}. [${d.type.toUpperCase()}] ${d.description}\n   Baseline: "${d.baseline_text}"\n   Latest:   "${d.latest_text ?? 'MISSING'}"`
      ).join('\n\n');

  return { aiReviewResult, differencesFound };
}
