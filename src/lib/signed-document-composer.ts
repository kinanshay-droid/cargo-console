// Client-only: flattens the courier's captured per-field signatures onto
// the original "document to sign" so both the courier and staff can view
// one finished, signed file instead of a blank document plus separate
// signature snapshots. Runs entirely in the browser — image documents use
// the canvas API; PDFs use pdf-lib loaded from cdnjs at runtime (same
// pattern as pdf.js in signature-field-placer.tsx: a dynamic
// `import(/* @vite-ignore */ url)`, never a static/top-level import, so
// this heavy library never ships in the app bundle and never runs during
// SSR — this module must only ever be called from client event handlers).
//
// Unlike the page-1-only preview in signature-field-placer.tsx, the PDF
// path here loads and re-saves the *real* PDF bytes via pdf-lib, so every
// original page survives — only page 1 (where fields can be placed) gets
// the signature images drawn onto it.
const PDF_LIB_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";

export type ComposeField = {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  signedUrl: string | null;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("לא ניתן לטעון תמונה לצורך הרכבת המסמך"));
    img.src = url;
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function composeImageDocument(fileUrl: string, fields: ComposeField[]): Promise<string> {
  const baseImg = await loadImage(fileUrl);
  const canvas = document.createElement("canvas");
  canvas.width = baseImg.naturalWidth;
  canvas.height = baseImg.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(baseImg, 0, 0);

  for (const f of fields) {
    if (!f.signedUrl) continue;
    const sigImg = await loadImage(f.signedUrl);
    const sigWidth = canvas.width * 0.22;
    const sigHeight = sigWidth * (sigImg.naturalHeight / sigImg.naturalWidth);
    const x = (f.xPercent / 100) * canvas.width - sigWidth / 2;
    const y = (f.yPercent / 100) * canvas.height - sigHeight;
    ctx.drawImage(sigImg, x, y, sigWidth, sigHeight);
  }
  return canvas.toDataURL("image/png");
}

async function composePdfDocument(fileUrl: string, fields: ComposeField[]): Promise<string> {
  // @vite-ignore — deliberately loaded from a CDN at runtime, not bundled.
  const PDFLib = await import(/* @vite-ignore */ PDF_LIB_URL);
  const { PDFDocument } = PDFLib;
  const pdfBytes = await fetch(fileUrl).then((r) => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPage(0);
  const { width, height } = page.getSize();

  for (const f of fields) {
    if (!f.signedUrl) continue;
    const sigBytes = await fetch(f.signedUrl).then((r) => r.arrayBuffer());
    // Field signatures always come from SignaturePad, which only ever
    // exports PNG (canvas.toDataURL("image/png")).
    const sigImage = await pdfDoc.embedPng(sigBytes);
    const sigWidth = width * 0.22;
    const sigHeight = sigWidth * (sigImage.height / sigImage.width);
    const x = (f.xPercent / 100) * width - sigWidth / 2;
    // PDF coordinates are bottom-up; xPercent/yPercent were captured
    // top-down against the rendered page, so flip the y axis.
    const y = height - (f.yPercent / 100) * height - sigHeight;
    page.drawImage(sigImage, { x, y, width: sigWidth, height: sigHeight });
  }
  const outBytes: Uint8Array = await pdfDoc.save();
  return `data:application/pdf;base64,${bytesToBase64(outBytes)}`;
}

export async function composeSignedDocument(
  fileUrl: string,
  isPdf: boolean,
  fields: ComposeField[],
): Promise<string> {
  return isPdf ? composePdfDocument(fileUrl, fields) : composeImageDocument(fileUrl, fields);
}
