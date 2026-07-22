import mappingData from './document-proof-mapping.json';

export function getProofTextByDocumentId(documentId: string): { proofText: string; proofToken: string } | null {
  const mapping = (mappingData.mappings as any[]).find((m) => m.documentId === documentId);
  return mapping ? { proofText: mapping.proofText, proofToken: mapping.proofToken } : null;
}

export function getProofIdByDocumentName(documentName: string): string | null {
  const mapping = (mappingData.mappings as any[]).find((m) => m.documentName === documentName);
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
