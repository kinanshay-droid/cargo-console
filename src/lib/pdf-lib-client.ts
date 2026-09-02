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

// pdf-lib's built-in StandardFonts (Helvetica etc.) can only encode
// WinAnsi — Latin text. Drawing any Hebrew character with them throws
// "WinAnsi cannot encode" at save time, which broke composing a signed
// PDF the moment a courier typed a Hebrew name into a "שם" field (see
// signed-document-composer.ts). Fix: embed a real Hebrew-capable font via
// fontkit instead of using a standard font for any drawn text.
//
// @pdf-lib/fontkit ships only as a UMD/CJS bundle — like pdf-lib.min.js,
// a browser dynamic import() against the raw UMD build silently yields no
// usable exports. esm.sh re-publishes the same package as a real ES
// module (with a working default export), so it's used here instead of
// cdnjs, which doesn't carry this package at all.
const FONTKIT_ESM_URL = "https://esm.sh/@pdf-lib/fontkit@1.1.1";
// Google's "Alef" Hebrew font, fetched from the canonical google/fonts
// source repo (not a Google Fonts css2 endpoint, which serves WOFF2 that
// fontkit can't parse). Verified glyph-by-glyph (live, via fontkit) to
// cover digits, ".", ":", "/" AND Hebrew letters — required for both
// "שם" (name) text and תאריך/שעה stamps, which mix both.
//
// The googlefonts/noto-fonts "hinted/ttf" per-script delivery build used
// here originally does NOT include this: it maps every digit and every
// punctuation glyph to glyph id 0 (".notdef"), so pdf-lib silently drew
// empty/placeholder boxes for any date or time text (letters-only text
// like a typed name still looked fine) — that per-script Noto build only
// carries the Hebrew block, unlike a font's canonical google/fonts
// source file, which is a full multi-script static font.
const HEBREW_FONT_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/alef/Alef-Regular.ttf";

let hebrewFontBytesPromise: Promise<ArrayBuffer> | null = null;
function loadHebrewFontBytes(): Promise<ArrayBuffer> {
  if (!hebrewFontBytesPromise) {
    hebrewFontBytesPromise = fetch(HEBREW_FONT_URL).then((r) => {
      if (!r.ok) throw new Error("לא ניתן לטעון גופן עברי");
      return r.arrayBuffer();
    });
  }
  return hebrewFontBytesPromise;
}

// Registers fontkit on the given PDFDocument and embeds/returns the
// Hebrew-capable font, ready to pass to page.drawText(). Call once per
// PDFDocument, before any drawText() call that might contain Hebrew.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function embedHebrewFont(pdfDoc: any): Promise<any> {
  const fontkitModule = await import(/* @vite-ignore */ FONTKIT_ESM_URL);
  const fontkit = fontkitModule.default ?? fontkitModule;
  pdfDoc.registerFontkit(fontkit);
  const fontBytes = await loadHebrewFontBytes();
  return pdfDoc.embedFont(fontBytes, { subset: true });
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
