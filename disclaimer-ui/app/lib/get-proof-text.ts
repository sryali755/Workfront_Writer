// @ts-nocheck
// Use 'any' to avoid strict type checking on the JSON mapping
const mappingData = require('./document-proof-mapping.json') as any;

export function getProofIdByDocumentName(documentName: string): string | null {
  const mapping = mappingData.mappings.find((m: any) => m.documentName === documentName);
  return mapping?.proofId || null;
}

export function addProofMapping(documentId: string, proofText: string, proofToken: string = ''): void {
  // This is a helper for manual updates to the mapping file
  const existing = mappingData.mappings.findIndex((m) => m.documentId === documentId);
  if (existing >= 0) {
    mappingData.mappings[existing] = { documentId, proofText, proofToken };
  } else {
    mappingData.mappings.push({ documentId, proofText, proofToken });
  }
}
