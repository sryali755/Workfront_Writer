import 'dotenv/config';
import express from 'express';
import { runDisclaimerReview } from './index.js';

const app = express();
app.use(express.json());

// Fusion Watch Event → HTTP module POSTs here with the Workfront issue payload
// Expects body.ID (Workfront sends the full issue object; ID is at the top level)
app.post('/webhook', async (req, res) => {
  const issueId = req.body.ID || req.body.issueId;

  if (!issueId) {
    return res.status(400).json({ error: 'Missing issue ID. Expected body.ID or body.issueId.' });
  }

  try {
    const result = await runDisclaimerReview(issueId);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Disclaimer review webhook listening on port ${PORT}`));
