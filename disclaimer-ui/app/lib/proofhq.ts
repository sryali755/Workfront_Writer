// ProofHQ (Workfront Proof) REST API helper.
//
// AUTH — there are two possible mechanisms and we support both, because Adobe's
// guidance (SOAP doLogin with email+password) does not match the REST API our
// integration targets (rest.proofhq.com/api/v1). See app/lib/README-proofhq.md.
//
//   1. Session auth: POST /authorize { email, authtoken } -> { sessionId }.
//      sessionId is then sent on every request. It renews on each call and
//      expires after a short idle period, so we cache it and re-authorize on 401.
//   2. Service-token auth: a WF-Service-Token sent directly, no /authorize step.
//
// Configure whichever the Proof Admin provisions. If PROOFHQ_SERVICE_TOKEN is
// set we use it directly; otherwise we fall back to the email/authtoken flow.

const SERVERS: Record<string, string> = {
  US: 'https://rest.proofhq.com/api/v1',
  EU: 'https://api-eu.proofhq.com/api/v1',
};

function baseUrl(): string {
  const server = (process.env.PROOFHQ_SERVER ?? 'US').toUpperCase();
  return SERVERS[server] ?? SERVERS.US;
}

// Cached session for the session-auth flow (module scope = per warm lambda).
let cachedSessionId: string | null = null;

async function authorize(): Promise<string> {
  const email = process.env.PROOFHQ_EMAIL;
  const authtoken = process.env.PROOFHQ_AUTHTOKEN ?? process.env.PROOFHQ_PASSWORD;
  if (!email || !authtoken) {
    throw new Error(
      'ProofHQ session auth requires PROOFHQ_EMAIL and PROOFHQ_AUTHTOKEN (or PROOFHQ_PASSWORD).'
    );
  }

  const res = await fetch(`${baseUrl()}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, authtoken }),
  });

  if (!res.ok) {
    throw new Error(`ProofHQ /authorize failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const sessionId: string | undefined = data?.sessionId;
  if (!sessionId) {
    throw new Error('ProofHQ /authorize returned no sessionId.');
  }
  cachedSessionId = sessionId;
  return sessionId;
}

// Build auth headers for a request. Prefers a service token if configured.
async function authHeaders(forceReauth = false): Promise<Record<string, string>> {
  const serviceToken = process.env.PROOFHQ_SERVICE_TOKEN;
  if (serviceToken) {
    return { 'WF-Service-Token': serviceToken };
  }
  const sessionId = !forceReauth && cachedSessionId ? cachedSessionId : await authorize();
  return { sessionId };
}

// Authenticated fetch against the ProofHQ REST API. Retries once on 401 by
// re-authorizing (session may have expired).
export async function proofhqFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
    ...(await authHeaders()),
  };

  let res = await fetch(`${baseUrl()}${path}`, { ...init, headers });

  if (res.status === 401 && !process.env.PROOFHQ_SERVICE_TOKEN) {
    cachedSessionId = null;
    const retryHeaders = {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(await authHeaders(true)),
    };
    res = await fetch(`${baseUrl()}${path}`, { ...init, headers: retryHeaders });
  }

  return res;
}

// Search for a proof by name.
// GET /proofs?query[name]={name}
export async function findProofByName(name: string): Promise<{ id: string; name: string } | null> {
  const res = await proofhqFetch(`/proofs?query[name]=${encodeURIComponent(name)}`);

  if (!res.ok) {
    console.error('ProofHQ proof search failed:', res.status);
    return null;
  }

  const data = await res.json().catch(() => null);
  if (!data?.data || data.data.length === 0) {
    return null;
  }

  const proof = data.data[0];
  return {
    id: proof.id,
    name: proof.name,
  };
}

// Post a comment onto a proof.
// POST /proofs/{proofToken}/comments  body: { text, ...optional }
export async function postProofComment(
  proofToken: string,
  text: string,
  extra: Record<string, unknown> = {}
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const path = `/proofs/${encodeURIComponent(proofToken)}/comments`;
  console.log('Posting to ProofHQ:', { path, proofToken });

  const res = await proofhqFetch(path, {
    method: 'POST',
    body: JSON.stringify({ text, ...extra }),
  });

  const body = await res.json().catch(() => null);
  console.log('ProofHQ response:', { status: res.status, ok: res.ok, body: JSON.stringify(body).substring(0, 200) });
  return { ok: res.ok, status: res.status, body };
}
