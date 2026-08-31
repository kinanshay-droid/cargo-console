// Client-only: flattens the courier's captured per-field signatures onto
// the original "document to sign" so both the courier and staff can view
// one finished, signed file instead of a blank document plus separate
// signature snapshots. Runs entirely in the browser — image documents use
// the canvas API; PDFs use pdf-lib (see src/lib/pdf-lib-client.ts) loaded
// from cdnjs at runtime — this module must only ever be called from client
// event handlers.
//
// Unlike the page-1-only preview in signature-field-placer.tsx, the PDF
// path here loads and re-saves the *real* PDF bytes via pdf-lib, so every
// original page survives — only page 1 (where fields can be placed) gets
// the signature images (and any date/time stamp text) drawn onto it.
import { loadPdfLib, bytesToDataUrl } from "@/lib/pdf-lib-client";
import type { SignatureFieldKind } from "@/lib/courier-portal.functions";

// A marked spot is where staff clicked on the document — typically right on
// or just before an "X" / signature line on the source form — so whatever
// gets drawn there (a signature image, or a date/time stamp) starts AT
// that point and extends to the right (beside it), vertically centered on
// it rather than stacked above it.
const SIGNATURE_WIDTH_RATIO = 0.14;
const TEXT_SIZE_RATIO = 0.016;

export type ComposeField = {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  kind: SignatureFieldKind;
  signedUrl: string | null;
  displayText: string | null;
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

async function composeImageDocument(fileUrl: string, fields: ComposeField[]): Promise<string> {
  const baseImg = await loadImage(fileUrl);
  const canvas = document.createElement("canvas");
  canvas.width = baseImg.naturalWidth;
  canvas.height = baseImg.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(baseImg, 0, 0);

  for (const f of fields) {
    const x = (f.xPercent / 100) * canvas.width;
    const yCenter = (f.yPercent / 100) * canvas.height;
    if (f.kind === "signature") {
      if (!f.signedUrl) continue;
      const sigImg = await loadImage(f.signedUrl);
      const sigWidth = canvas.width * SIGNATURE_WIDTH_RATIO;
      const sigHeight = sigWidth * (sigImg.naturalHeight / sigImg.naturalWidth);
      ctx.drawImage(sigImg, x, yCenter - sigHeight / 2, sigWidth, sigHeight);
    } else {
      // Date/time stamp — text, not an image, auto-filled from the
      // linked signature's own signing time (see
      // buildComposeFieldMeta in courier-portal.functions.ts).
      if (!f.displayText) continue;
      const fontSize = canvas.width * TEXT_SIZE_RATIO;
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = "#111827";
      ctx.textBaseline = "middle";
      ctx.fillText(f.displayText, x, yCenter);
    }
  }
  return canvas.toDataURL("image/png");
}

async function composePdfDocument(fileUrl: string, fields: ComposeField[]): Promise<string> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const pdfBytes = await fetch(fileUrl).then((r) => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPage(0);
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const f of fields) {
    // PDF coordinates are bottom-up; xPercent/yPercent were captured
    // top-down against the rendered page, so flip the y axis.
    const x = (f.xPercent / 100) * width;
    const yCenter = height - (f.yPercent / 100) * height;
    if (f.kind === "signature") {
      if (!f.signedUrl) continue;
      const sigBytes = await fetch(f.signedUrl).then((r) => r.arrayBuffer());
      // Field signatures always come from SignaturePad, which only ever
      // exports PNG (canvas.toDataURL("image/png")).
      const sigImage = await pdfDoc.embedPng(sigBytes);
      const sigWidth = width * SIGNATURE_WIDTH_RATIO;
      const sigHeight = sigWidth * (sigImage.height / sigImage.width);
      page.drawImage(sigImage, {
        x,
        y: yCenter - sigHeight / 2,
        width: sigWidth,
        height: sigHeight,
      });
    } else {
      if (!f.displayText) continue;
      const fontSize = width * TEXT_SIZE_RATIO;
      // pdf-lib positions text by its baseline, not a vertical center —
      // nudge down by roughly a third of the font size to approximate
      // centering on the marked point.
      page.drawText(f.displayText, {
        x,
        y: yCenter - fontSize * 0.35,
        size: fontSize,
        font,
        color: rgb(0.07, 0.09, 0.15),
      });
    }
  }
  const outBytes: Uint8Array = await pdfDoc.save();
  return bytesToDataUrl(outBytes, "application/pdf");
}

export async function composeSignedDocument(
  fileUrl: string,
  isPdf: boolean,
  fields: ComposeField[],
): Promise<string> {
  return isPdf ? composePdfDocument(fileUrl, fields) : composeImageDocument(fileUrl, fields);
}
