// ProofHQ file upload helper
// Uploads a PDF to ProofHQ and returns the proof token

import { https } from 'https';

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

    // Use form-data for multipart upload
    // @ts-ignore
    const FormData = require('form-data');
    const formData = new FormData();

    // Append file as buffer with filename
    formData.append('file', pdfBuffer, fileName);

    // Add optional parameters
    if (options.name) {
      formData.append('name', options.name);
    }
    if (options.message) {
      formData.append('message', options.message);
    }

    const baseUrl = process.env.PROOFHQ_SERVER === 'EU'
      ? 'https://api-eu.proofhq.com/api/v1'
      : 'https://rest.proofhq.com/api/v1';

    console.log('Sending multipart upload to ProofHQ');

    // Use fetch with proper error handling
    const uploadRes = await new Promise<Response>((resolve, reject) => {
      fetch(`${baseUrl}/upload`, {
        method: 'POST',
        headers: {
          ...formData.getHeaders(),
          'sessionId': sessionId,
        },
        body: formData as any,
      })
        .then(resolve)
        .catch(reject);
    });

    const responseText = await uploadRes.text();
    console.log('ProofHQ upload response status:', uploadRes.status);
    console.log('ProofHQ upload response:', responseText.substring(0, 300));

    if (!uploadRes.ok) {
      console.error('ProofHQ upload failed:', { status: uploadRes.status });
      return { ok: false, error: `Upload failed: ${uploadRes.status}` };
    }

    let uploadData;
    try {
      uploadData = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse ProofHQ response');
      return { ok: false, error: 'Invalid response format from ProofHQ' };
    }

    // The response is an array of uploaded files
    // ProofHQ returns [{ token, warning, error, ... }]
    let proofToken: string | undefined;

    if (Array.isArray(uploadData) && uploadData.length > 0) {
      const uploadInfo = uploadData[0];
      proofToken = uploadInfo.token;
      if (uploadInfo.error) {
        console.error('ProofHQ upload error:', uploadInfo.error);
        return { ok: false, error: uploadInfo.error };
      }
    } else if (uploadData?.token) {
      proofToken = uploadData.token;
    }

    if (!proofToken) {
      console.error('No token in upload response');
      return { ok: false, error: 'No proof token returned from ProofHQ' };
    }

    console.log('✓ PDF uploaded to ProofHQ, token:', proofToken.substring(0, 10) + '...');
    return { ok: true, proofToken };
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
