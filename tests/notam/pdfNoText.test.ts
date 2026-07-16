import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ensureExploitablePdfText, pageTextFromItems } from '../../src/services/notam/pdfTextExtractor';

describe('PDF without exploitable text', () => {
  it('rejects a real blank PDF without starting OCR', async () => {
    const source = await PDFDocument.create();
    source.addPage([595, 842]);
    const data = new Uint8Array(await source.save());
    const standardFontDataUrl = `${fileURLToPath(new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url))}/`;
    const document = await getDocument({ data, disableWorker: true, isEvalSupported: false, standardFontDataUrl }).promise;
    const page = await document.getPage(1);
    const content = await page.getTextContent();
    const text = pageTextFromItems(content.items as Parameters<typeof pageTextFromItems>[0]);
    await document.destroy();

    expect(() => ensureExploitablePdfText(text)).toThrow('Aucun OCR automatique');
  }, 20_000);
});
