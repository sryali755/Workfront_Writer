import { NextRequest, NextResponse } from 'next/server';

export const config = {
  maxDuration: 300,
};

export const runtime = 'nodejs';
import { postProofComment, findProofByName } from '../../lib/proofhq';
import { getProofTextByDocumentId, getProofIdByDocumentName } from '../../lib/get-proof-text';

const WRITER_API_URL = 'https://api.writer.com/v1/chat';
const WORKFRONT_BASE = 'https://comcastcorp.sb01.workfront.com';
const WORKFRONT_API_BASE = `${WORKFRONT_BASE}/attask/api/v17.0`;

type Finding = {
  findingNumber: number;
  pageNumber: string;
  category: 'Brand Guideline Compliance' | 'Product Naming' | 'Spelling and Typographical Errors' | 'Language Sense';
  severity: 'Critical' | 'Major' | 'Minor' | 'Suggestion';
  issue: string;
  recommendedRevision: string;
  reason: string;
  confidence: 'High' | 'Medium' | 'Low';
};

type ColdReadResult = {
  summary: {
    reviewType: 'Cold Read';
    overallStatus: string;
    totalFindings: number;
    critical: number;
    major: number;
    minor: number;
    suggestions: number;
  };
  findings: Finding[];
  workfrontComments: Array<{
    pageNumber: string;
    severity: Finding['severity'];
    comment: string;
  }>;
  overallAssessment: string;
};

type WebhookRequest = {
  documentId?: string;
  documentName?: string;
  projectId?: string;
  proofToken?: string;
  proofText?: string;
  pdfFile?: string; // base64-encoded PDF
  pdfDownloadUrl?: string; // URL to download PDF from
};

type WorkfrontDocument = {
  ID: string;
  name?: string;
  downloadURL?: string;
  currentVersion?: {
    ext?: string;
    fileName?: string;
  };
};

const SYSTEM_PROMPT = `You are an expert Xfinity Editorial Copy Editor.

Always use the Editorial Read Documentation and Copy Editing & Proofreading Workflow as the governing methodology.

Review ONLY the uploaded proof text supplied in the user message.
Perform ONLY a Cold Read.

Do not perform:
- Word-for-Word Read
- Check Changes
- Version comparison
- Backup comparison
- Creative review
- Marketing review
- Copywriting improvements

Evaluate only:
- Brand Guideline Compliance
- Product Naming
- Spelling and Typographical Errors
- Language Sense (grammar, clarity, readability)

Report only issues that are directly observable in the proof text.
Never invent issues.
Never guess missing or truncated content.
Never rewrite marketing copy.
Ignore reviewer comments, browser UI, metadata, ProofHQ interface elements, timestamps, filenames, and OCR artifacts.
Do not report spelling, capitalization, or grammar issues within logos, trademarks, licensed artwork, or supplied creative assets unless the proof explicitly indicates the text is editable marketing copy.

If an issue cannot be confirmed from the visible proof, use this recommendation exactly:
"Verify against the approved backup/source document."

Methodology:
- A Cold Read means no reference material or backup is used for comparison.
- Cold Read checks are limited to brand guidelines, product naming, spelling/typos, and language sense.
- Findings must be specific, directly observable, and actionable.
- If there are no directly observable issues, return zero findings and mark the proof Ready to proceed.

Return valid JSON only with this shape:
{
  "summary": {
    "reviewType": "Cold Read",
    "overallStatus": "Ready to proceed" | "Requires revision" | "Unable to Review",
    "totalFindings": 0,
    "critical": 0,
    "major": 0,
    "minor": 0,
    "suggestions": 0
  },
  "findings": [
    {
      "findingNumber": 1,
      "pageNumber": "Page 1",
      "category": "Brand Guideline Compliance" | "Product Naming" | "Spelling and Typographical Errors" | "Language Sense",
      "severity": "Critical" | "Major" | "Minor" | "Suggestion",
      "issue": "Directly observable issue.",
      "recommendedRevision": "Concise correction or Verify against the approved backup/source document.",
      "reason": "Why this matters under the Cold Read methodology.",
      "confidence": "High" | "Medium" | "Low"
    }
  ],
  "workfrontComments": [
    {
      "pageNumber": "Page 1",
      "severity": "Minor",
      "comment": "Production-ready Workfront comment."
    }
  ],
  "overallAssessment": "Concise assessment of editorial quality and whether the proof is ready to proceed or requires revision."
}`;

function textFromBody(body: Record<string, unknown>): string {
  const candidates = [
    body.proofText,
    body.documentText,
    body.extractedText,
    body.text,
  ];

  const text = candidates.find((value) => typeof value === 'string' && value.trim());
  return typeof text === 'string' ? text.trim() : '';
}

function isUsableProofText(proofText: string, documentName?: string): boolean {
  if (!proofText) return false;
  if (documentName && proofText.trim() === documentName.trim()) return false;
  if (proofText.trim().length < 80) return false;
  return true;
}

async function getWorkfrontDocument(documentId: string): Promise<WorkfrontDocument> {
  const apiKey = process.env.WORKFRONT_API_KEY;
  if (!apiKey) {
    throw new Error('WORKFRONT_API_KEY is not configured.');
  }

  const fields = encodeURIComponent(
    'ID,name,downloadURL,currentVersion:ext,currentVersion:fileName'
  );
  const url = `${WORKFRONT_API_BASE}/document/${encodeURIComponent(documentId)}?fields=${fields}&apiKey=${apiKey}`;
  console.log('Fetching Workfront document:', { documentId, url });

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    console.error('Workfront API error:', { status: res.status, documentId, text: text.substring(0, 200) });
    throw new Error(`Workfront document fetch failed: ${res.status} ${text.substring(0, 100)}`);
  }

  const data = await res.json();
  console.log('Workfront document fetched:', { documentId, hasDownloadURL: !!data?.data?.downloadURL });

  if (!data?.data?.downloadURL) {
    throw new Error('Workfront document fetch returned no downloadURL.');
  }

  return data.data;
}

async function downloadWorkfrontDocument(downloadURL: string): Promise<Buffer> {
  const apiKey = process.env.WORKFRONT_API_KEY;
  if (!apiKey) {
    throw new Error('WORKFRONT_API_KEY is not configured.');
  }

  let fullUrl = downloadURL;
  if (!downloadURL.startsWith('http')) {
    fullUrl = `${WORKFRONT_BASE}${downloadURL}`;
  }

  const url = new URL(fullUrl);
  url.searchParams.set('apiKey', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Workfront document download failed: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    const text = await res.text();
    throw new Error(
      `Workfront document download returned HTML instead of PDF. Status: ${res.status}. Response: ${text.substring(0, 200)}`
    );
  }

  return Buffer.from(await res.arrayBuffer());
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParseModule = (await import('pdf-parse/lib/pdf-parse')) as unknown;
  const pdfParse =
    typeof pdfParseModule === 'function'
      ? pdfParseModule
      : (pdfParseModule as { default: (data: Buffer) => Promise<{ text: string }> }).default;
  const result = await pdfParse(buffer);
  return result.text.trim();
}

async function fetchProofTextFromWorkfront(documentId: string): Promise<{
  text: string;
  documentName?: string;
  source: string;
}> {
  const document = await getWorkfrontDocument(documentId);
  const ext = document.currentVersion?.ext?.toLowerCase();

  if (ext && ext !== 'pdf') {
    throw new Error(`Unsupported Workfront document type for text extraction: ${ext}`);
  }

  const file = await downloadWorkfrontDocument(document.downloadURL ?? '');
  const text = await extractPdfText(file);

  return {
    text,
    documentName: document.name ?? document.currentVersion?.fileName,
    source: 'workfront-download',
  };
}

function buildColdReadComment(result: ColdReadResult, documentName?: string) {
  const lines = [
    'Editorial Cold Read Report',
    documentName ? `Proof: ${documentName}` : '',
    '',
    'Output 1 - Editorial Cold Read Summary',
    `Review Type: ${result.summary.reviewType}`,
    `Overall Status: ${result.summary.overallStatus}`,
    `Total Findings: ${result.summary.totalFindings}`,
    `Critical: ${result.summary.critical}`,
    `Major: ${result.summary.major}`,
    `Minor: ${result.summary.minor}`,
    `Suggestions: ${result.summary.suggestions}`,
    '',
    'Output 2 - Editorial Findings',
  ].filter(Boolean);

  if (result.findings.length === 0) {
    lines.push('No directly observable editorial issues found.');
  } else {
    result.findings.forEach((finding) => {
      lines.push(
        `${finding.findingNumber}. ${finding.pageNumber} | ${finding.category} | ${finding.severity}`,
        `Issue: ${finding.issue}`,
        `Recommended Revision: ${finding.recommendedRevision}`,
        `Reason: ${finding.reason}`,
        `Confidence: ${finding.confidence}`,
        ''
      );
    });
  }

  lines.push('Output 3 - Workfront Editorial Comments');
  if (result.workfrontComments.length === 0) {
    lines.push('No Workfront comments required.');
  } else {
    result.workfrontComments.forEach((comment, index) => {
      lines.push(`${index + 1}. ${comment.pageNumber} | ${comment.severity}: ${comment.comment}`);
    });
  }

  lines.push('', 'Output 4 - Overall Assessment', result.overallAssessment);
  return lines.join('\n');
}

function unableToReviewResult(reason: string): ColdReadResult {
  return {
    summary: {
      reviewType: 'Cold Read',
      overallStatus: 'Unable to Review',
      totalFindings: 0,
      critical: 0,
      major: 0,
      minor: 0,
      suggestions: 0,
    },
    findings: [],
    workfrontComments: [
      {
        pageNumber: 'N/A',
        severity: 'Major',
        comment: `${reason} Verify against the approved backup/source document.`,
      },
    ],
    overallAssessment: `${reason} Verify against the approved backup/source document.`,
  };
}

export async function POST(req: NextRequest) {
  try {
    let body: WebhookRequest;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const pdfFileBlob = formData.get('pdfFile') as Blob | null;
      body = {
        documentId: formData.get('documentId') as string,
        documentName: formData.get('documentName') as string,
        projectId: formData.get('projectId') as string,
        proofToken: (formData.get('proofToken') as string) || '',
      };
      if (pdfFileBlob) {
        const fileSize = pdfFileBlob.size;
        if (fileSize > 1024 * 1024 * 1024) {
          throw new Error(`File size ${(fileSize / (1024 * 1024 * 1024)).toFixed(2)}GB exceeds 1GB limit.`);
        }
        const buffer = Buffer.from(await pdfFileBlob.arrayBuffer());
        const text = await extractPdfText(buffer);
        body.proofText = text;
      }
    } else {
      body = await req.json() as WebhookRequest;
    }

    // DEBUG: Log what we received
    console.log('Webhook received:', {
      documentId: body.documentId,
      documentName: body.documentName,
      projectId: body.projectId,
      pdfFilePresent: !!body.pdfFile,
      pdfFileLength: body.pdfFile?.length,
      proofText: body.proofText?.substring?.(0, 100),
      allKeys: Object.keys(body),
    });

    let documentName = body.documentName;
    const documentId = body.documentId;
    const proofToken = body.proofToken || body.proofToken || '';
    let proofText = textFromBody(body);
    let proofTextSource = proofText ? 'request-body' : '';

    let result: ColdReadResult | undefined;

    // If no proofText in request, try to download and extract from URL
    if (!isUsableProofText(proofText, documentName) && body.pdfDownloadUrl) {
      try {
        const pdfBuffer = await downloadWorkfrontDocument(body.pdfDownloadUrl);
        proofText = await extractPdfText(pdfBuffer);
        proofTextSource = 'pdf-download-url';
      } catch (err) {
        console.error('Failed to download/extract PDF from URL:', err instanceof Error ? err.message : err);
      }
    }

    // If no proofText in request, try to fetch document by documentId
    if (!isUsableProofText(proofText, documentName) && documentId) {
      try {
        const wfDoc = await fetchProofTextFromWorkfront(documentId);
        proofText = wfDoc.text;
        proofTextSource = 'workfront-fetch';
        if (!documentName) documentName = wfDoc.documentName;
      } catch (err) {
        console.error('Failed to fetch document from Workfront:', err instanceof Error ? err.message : err);
      }
    }


    if (!isUsableProofText(proofText, documentName)) {
      result = unableToReviewResult(
        'No readable proof text was provided to the Editorial Cold Read webhook. Fusion must extract the PDF text and send it as proofText in the request body.'
      );
    } else if (!result) {
      const writerRes = await fetch(WRITER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WRITER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'palmyra-x-004',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Perform an Editorial Cold Read of the uploaded proof text below. Preserve page references when provided. Return JSON only.\n\nUPLOADED PROOF TEXT:\n${proofText}`,
            },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      });

      if (!writerRes.ok) {
        const err = await writerRes.text();
        return NextResponse.json({ error: `Writer API error: ${err}` }, { status: writerRes.status });
      }

      const writerData = await writerRes.json();
      result = JSON.parse(writerData.choices[0].message.content);
    }

    const coldReadResult =
      result ??
      unableToReviewResult('No readable proof text was provided to the Editorial Cold Read webhook.');
    const reviewComment = buildColdReadComment(coldReadResult, documentName);
    const proofHqResult: { posted: boolean; status?: number; error?: string; proofId?: string } = { posted: false };

    // Try to post to ProofHQ using document name mapping
    if (documentName && !proofToken) {
      try {
        const proofId = getProofIdByDocumentName(documentName);
        if (proofId) {
          console.log('Found proof mapping:', { documentName, proofId });
          proofHqResult.proofId = proofId;
          const posted = await postProofComment(proofId, reviewComment);
          proofHqResult.posted = posted.ok;
          proofHqResult.status = posted.status;
          if (!posted.ok) {
            proofHqResult.error = 'ProofHQ comment POST failed.';
          }
        } else {
          console.log('No proof mapping found for document:', documentName);
          proofHqResult.error = `No proof mapping found for: ${documentName}`;
        }
      } catch (err) {
        proofHqResult.error = err instanceof Error ? err.message : 'ProofHQ request failed.';
      }
    }

    // If proofToken was provided directly, use it
    if (proofToken) {
      try {
        const posted = await postProofComment(proofToken, reviewComment);
        proofHqResult.posted = posted.ok;
        proofHqResult.status = posted.status;
        if (!posted.ok) {
          proofHqResult.error = 'ProofHQ comment POST failed.';
        }
      } catch (err) {
        proofHqResult.error = err instanceof Error ? err.message : 'ProofHQ request failed.';
      }
    }

    return NextResponse.json({
      success: true,
      documentId,
      documentName,
      proofTextSource: proofTextSource || undefined,
      proofToken: proofToken || undefined,
      proofHq: proofHqResult,
      coldRead: coldReadResult,
      comment: reviewComment,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Editorial Cold Read webhook failed.';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
