import fetch from 'node-fetch';

const WORKFRONT_BASE = 'https://comcastcorp.sb01.workfront.com/attask/api/v17.0';

export async function getIssueFields(issueId, apiKey) {
  const fields = 'ID,name,DE:Baseline_Disclaimer,DE:Latest_Disclaimer,DE:AI_Review_Result,DE:Differences_Found';
  const url = `${WORKFRONT_BASE}/issue/${issueId}?fields=${fields}&apiKey=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Workfront GET error ${response.status}`);

  const data = await response.json();
  return data.data;
}

export async function updateIssueWithResult(issueId, aiReviewResult, differencesFound, apiKey) {
  const url = `${WORKFRONT_BASE}/issue/${issueId}?apiKey=${apiKey}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'DE:AI_Review_Result': aiReviewResult,
      'DE:Differences_Found': differencesFound
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Workfront PUT error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.data;
}
