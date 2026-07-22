import mappingData from './document-proof-mapping.json';

export interface ProofMapping {
  documentId: string;
  proofText: string;
  proofToken: string;
}

export function getProofTextByDocumentId(documentId: string): ProofMapping | null {
  return mappingData.mappings.find((m) => m.documentId === documentId) || null;
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
