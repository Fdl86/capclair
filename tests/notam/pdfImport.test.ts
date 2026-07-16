import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { BriefingRouteSnapshot } from '../../src/domain/notam.types';
import { pageTextFromItems } from '../../src/services/notam/pdfTextExtractor';
import { normalizeSofiaText } from '../../src/services/notam/sofiaText';
import { parsePibRouteContext } from '../../src/services/notam/pibContextParser';
import { parseNotams } from '../../src/services/notam/notamParser';

const route: BriefingRouteSnapshot = {
  routeId: 'pdf-test',
  routeName: 'LFBI > LFOU',
  departure: 'LFBI',
  destination: 'LFOU',
  alternates: ['LFJB', 'LFCT'],
  departureTimeIso: '2026-07-16T07:15:00Z',
  maxAltitudeFt: 3500,
  points: [
    { id: 'lfbi', nom: 'Poitiers', code: 'LFBI', type: 'depart', latitude: 46.5877, longitude: 0.3067 },
    { id: 'lfou', nom: 'Cholet', code: 'LFOU', type: 'destination', latitude: 47.0821, longitude: -0.8771 }
  ],
  signature: 'pdf-fixture'
};

describe('real SOFIA PDF import fixture', () => {
  it('extracts all 9 pages without OCR and parses 36 NOTAM', async () => {
    const path = fileURLToPath(new URL('../../src/services/notam/__fixtures__/sofia-lfbi-lfou.pdf', import.meta.url));
    const data = new Uint8Array(await readFile(path));
    const standardFontDataUrl = `${fileURLToPath(new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url))}/`;
    const document = await getDocument({ data, disableWorker: true, isEvalSupported: false, standardFontDataUrl }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(pageTextFromItems(content.items as Parameters<typeof pageTextFromItems>[0]));
      page.cleanup();
    }
    await document.destroy();

    const text = normalizeSofiaText(pages.join('\n\n'));
    const context = parsePibRouteContext(text);
    const notams = parseNotams(text, context, route);

    expect(pages).toHaveLength(9);
    expect(context.departure).toBe('LFBI');
    expect(context.destination).toBe('LFOU');
    expect(notams).toHaveLength(36);
    expect(notams.every((notam) => notam.fields.q?.center && notam.fields.q.radiusNm !== null)).toBe(true);
    expect(notams.find((notam) => notam.id === 'LFFA-R1871/26')?.exactPolygon).toHaveLength(34);
  }, 20_000);
});
