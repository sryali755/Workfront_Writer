import 'dotenv/config';
import { compareDisclaimers, formatResultForWorkfront } from './writerAI.js';
import { getIssueFields, updateIssueWithResult } from './workfront.js';

// Called by Fusion (or directly) with a Workfront issue ID
export async function runDisclaimerReview(issueId) {
  console.log(`Processing issue: ${issueId}`);

  const issue = await getIssueFields(issueId, process.env.WORKFRONT_API_KEY);
  const baseline = issue['DE:Baseline_Disclaimer'];
  const latest = issue['DE:Latest_Disclaimer'];

  if (!baseline || !latest) {
    throw new Error('Missing Baseline_Disclaimer or Latest_Disclaimer on issue');
  }

  const result = await compareDisclaimers(baseline, latest, process.env.WRITER_API_KEY);
  const { aiReviewResult, differencesFound } = formatResultForWorkfront(result);

  await updateIssueWithResult(issueId, aiReviewResult, differencesFound, process.env.WORKFRONT_API_KEY);

  console.log('Done. Results written back to Workfront.');
  return { aiReviewResult, differencesFound };
}
