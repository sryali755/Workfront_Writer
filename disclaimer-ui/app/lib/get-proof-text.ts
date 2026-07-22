import mappingData from './document-proof-mapping.json';

export interface ProofMapping {
  documentId?: string;
  documentName?: string;
  proofText?: string;
  proofToken?: string;
  proofId?: string;
}

export function getProofTextByDocumentId(documentId: string): ProofMapping | null {
  const mapping = mappingData.mappings.find((m: any) => m.documentId === documentId);
  return mapping || null;
}

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
