# ProofHQ integration

The code (`app/lib/proofhq.ts` + `app/api/post-proof-comment/route.ts`) is complete and
supports both auth mechanisms.

Status:
- Service-account email + authtoken auth has been provisioned.
- `POST /authorize` has been verified successfully against the US REST API.
- `app/api/fusion-webhook/route.ts` posts the AI review to ProofHQ when Fusion includes
  a `proofToken` in the webhook payload.

## The auth discrepancy to resolve
- Adobe's email describes the **SOAP** API: `doLogin(email, password)` -> session key,
  endpoint `https://soap.proofhq.com/soap`.
- Our integration targets the **REST** API (`https://rest.proofhq.com/api/v1`), which
  authenticates differently: `POST /authorize { email, authtoken }` -> `{ sessionId }`.
  Note: `authtoken`, not a raw password. It also accepts `sessionId`, JWT, or
  `WF-Service-Token` on requests.

The helper handles either REST auth option:

## Supported credentials
Pick ONE:
1. **Service account email + authtoken** (recommended for production) -> set
   `PROOFHQ_EMAIL` + `PROOFHQ_AUTHTOKEN`.
2. **A WF-Service-Token** -> set `PROOFHQ_SERVICE_TOKEN` (skips the /authorize step).

Plus:
- Confirm the **server** (`PROOFHQ_SERVER=US` or `EU`).
- The **proofToken** for a given proof (how Fusion/Workfront surfaces it to us).

## Env vars
See `.env.local`. Set the same in Vercel project **environment variables** before deploy.

## Testing
```
curl -X POST http://localhost:3000/api/post-proof-comment \
  -H 'Content-Type: application/json' \
  -d '{"proofToken":"<token>","text":"Writer AI test comment"}'
```

## Still needed from Fusion/Workfront
- Include the proof token for the target proof in the Fusion webhook payload as
  `proofToken` (or `proof_token`). Without that token, the webhook still completes the
  Writer AI review and Workfront issue comment, but skips the ProofHQ comment.
