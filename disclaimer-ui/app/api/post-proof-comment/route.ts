import { NextRequest, NextResponse } from 'next/server';
import { postProofComment } from '../../lib/proofhq';

// POST a comment onto a Workfront Proof (ProofHQ) as the Writer AI reviewer.
// Body: { proofToken, text }
export async function POST(req: NextRequest) {
  const { proofToken, text } = await req.json();

  if (!proofToken || !text) {
    return NextResponse.json(
      { error: 'proofToken and text are required.' },
      { status: 400 }
    );
  }

  try {
    const result = await postProofComment(proofToken, text);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'ProofHQ comment POST failed.', status: result.status, details: result.body },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true, comment: result.body });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ProofHQ request failed.' },
      { status: 500 }
    );
  }
}
