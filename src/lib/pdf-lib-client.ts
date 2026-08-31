// Client-only helpers built on pdf-lib, loaded from cdnjs at runtime — same
// pattern as pdf.js in signature-field-placer.tsx: a dynamic
// `import(/* @vite-ignore */ url)`, never a static/top-level import, so the
// library never ships in the app bundle and never runs during SSR. Callers
// must only ever invoke these from client event handlers.
//
// Uses the ESM build specifically (pdf-lib.esm.min.js), not the default
// pdf-lib.min.js — that one is a UMD/IIFE bundle with no `export`
// statements, so a browser dynamic `import()` against it silently resolves
// to a module with no named exports (PDFDocument etc. all undefined)
// instead of throwing, which is a nasty silent-failure trap.
const PDF_LIB_ESM_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.esm.min.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPdfLib(): Promise<any> {
  // @vite-ignore — deliberately loaded from a CDN at runtime, not bundled.
  return import(/* @vite-ignore */ PDF_LIB_ESM_URL);
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

// Combines several image files (e.g. a multi-page scan taken as separate
// photos) into a single multi-page PDF, one image per page sized to that
// image — used when staff selects more than one file for the "document to
// sign" upload, since the rest of the signature-field system (placement,
// compositing) only ever works with one document file.
export async function combineImagesIntoPdf(files: File[]): Promise<string> {
  const { PDFDocument } = await loadPdfLib();
  const pdfDoc = await PDFDocument.create();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
    const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const outBytes: Uint8Array = await pdfDoc.save();
  return bytesToDataUrl(outBytes, "application/pdf");
}
