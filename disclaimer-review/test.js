import 'dotenv/config';
import { compareDisclaimers, formatResultForWorkfront } from './writerAI.js';

// Same example from your Workfront test submission
const BASELINE = `This offer is available to new residential customers only.
Requires 24-month agreement. Early termination fee applies.
Prices subject to change. Taxes and fees extra.
Service not available in all areas. ©2024 Comcast. All rights reserved.`;

const LATEST = `This offer is available to new residential customers only.
Requires 12-month agreement. Early termination fee applies.
Prices subject to change. Taxes and fees extra.
©2024 Comcast. All rights reserved.`;

async function run() {
  console.log('Calling Writer AI...\n');

  const result = await compareDisclaimers(BASELINE, LATEST, process.env.WRITER_API_KEY);
  const { aiReviewResult, differencesFound } = formatResultForWorkfront(result);

  console.log('=== AI REVIEW RESULT ===');
  console.log(aiReviewResult);
  console.log('\n=== DIFFERENCES FOUND ===');
  console.log(differencesFound);
  console.log('\n=== RAW JSON FROM WRITER AI ===');
  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
