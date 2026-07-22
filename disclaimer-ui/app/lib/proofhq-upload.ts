// ProofHQ file upload helper
// Uploads a PDF to ProofHQ and returns the proof token

// @ts-ignore - form-data doesn't have perfect TypeScript support in Node.js
const FormData = require('form-data');

export async function uploadPdfToProofHQ(
  pdfBuffer: Buffer,
  fileName: string,
  options: {
    name?: string;
    message?: string;
  } = {}
): Promise<{ ok: boolean; proofToken?: string; proofId?: string; error?: string }> {
  try {
    console.log('Uploading PDF to ProofHQ:', { fileName, size: pdfBuffer.length });

    // Get auth session
    const sessionId = await getProofHQSession();
    if (!sessionId) {
      return { ok: false, error: 'Failed to authenticate with ProofHQ' };
    }

    // Create FormData for multipart upload (Node.js version)
    const formData = new FormData();
    formData.append('file', pdfBuffer, { filename: fileName });

    if (options.name) {
      formData.append('name', options.name);
    }
    if (options.message) {
      formData.append('message', options.message);
    }

    const baseUrl = process.env.PROOFHQ_SERVER === 'EU'
      ? 'https://api-eu.proofhq.com/api/v1'
      : 'https://rest.proofhq.com/api/v1';

    const uploadRes = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: {
        ...formData.getHeaders(),
        sessionId,
      },
      body: formData as any,
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error('ProofHQ upload failed:', { status: uploadRes.status, error: errorText });
      return { ok: false, error: `Upload failed: ${uploadRes.status}` };
    }

    const uploadData = await uploadRes.json();
    console.log('ProofHQ upload response:', JSON.stringify(uploadData).substring(0, 300));

    // The response should contain proof data
    const proofToken = uploadData?.data?.token || uploadData?.token;
    const proofId = uploadData?.data?.id || uploadData?.id;

    if (!proofToken) {
      console.error('No token in upload response:', uploadData);
      return { ok: false, error: 'No proof token returned from ProofHQ' };
    }

    console.log('✓ PDF uploaded to ProofHQ:', { proofToken, proofId });
    return { ok: true, proofToken, proofId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload error';
    console.error('ProofHQ upload error:', message);
    return { ok: false, error: message };
  }
}

// Helper to get session ID (reuses auth logic from proofhq.ts)
async function getProofHQSession(): Promise<string | null> {
  const email = process.env.PROOFHQ_EMAIL;
  const authtoken = process.env.PROOFHQ_AUTHTOKEN ?? process.env.PROOFHQ_PASSWORD;

  if (!email || !authtoken) {
    console.error('ProofHQ credentials not configured');
    return null;
  }

  const baseUrl = process.env.PROOFHQ_SERVER === 'EU'
    ? 'https://api-eu.proofhq.com/api/v1'
    : 'https://rest.proofhq.com/api/v1';

  try {
    const res = await fetch(`${baseUrl}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, authtoken }),
    });

    if (!res.ok) {
      console.error('ProofHQ auth failed:', res.status);
      return null;
    }

    const data = await res.json();
    return data?.sessionId || null;
  } catch (err) {
    console.error('ProofHQ auth error:', err instanceof Error ? err.message : err);
    return null;
  }
}
