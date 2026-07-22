declare module 'pdf-parse' {
  type PdfParseResult = {
    text: string;
  };

  export default function pdfParse(data: Buffer): Promise<PdfParseResult>;
}

declare module 'pdf-parse/lib/pdf-parse' {
  type PdfParseResult = {
    text: string;
  };

  export default function pdfParse(data: Buffer): Promise<PdfParseResult>;
}
