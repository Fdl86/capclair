import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import fixture from '../../src/services/notam/__fixtures__/sofia-lfbi-lfou.txt?raw';
import type { BriefingRouteSnapshot } from '../../src/domain/notam.types';
import { analyzePibText } from '../../src/services/notam/pibAnalysis';

const route: BriefingRouteSnapshot = {
  routeId: 'analysis-test',
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
  signature: 'analysis-fixture'
};

async function readJson(relativePath: string) {
  return JSON.parse(await readFile(new URL(`../../public/data/${relativePath}`, import.meta.url), 'utf8'));
}

describe('PIB analysis with the real CAP CLAIR SUP AIP indexes', () => {
  beforeAll(async () => {
    const [manifest, unmapped, current] = await Promise.all([
      readJson('supaip-manifest.json'),
      readJson('supaip-unmapped.json'),
      readJson('supaip-current.geojson')
    ]);
    const payloads = new Map<string, unknown>([
      ['/data/supaip-manifest.json', manifest],
      ['/data/supaip-unmapped.json', unmapped],
      ['/data/supaip-current.geojson', current]
    ]);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname;
      const payload = payloads.get(url);
      if (!payload) return new Response('Not found', { status: 404 });
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('reconciles all three references and preserves the partial 055/26 warning', async () => {
    const analysis = await analyzePibText({
      text: fixture,
      sourceKind: 'text',
      sourceFileName: null,
      routeSnapshot: route
    });

    expect(analysis.routeContextMode).toBe('matching');
    expect(analysis.summary.totalNotams).toBe(36);
    expect(analysis.summary.supAipReferenceCount).toBe(3);
    expect(analysis.summary.supAipMatchCount).toBe(3);
    expect(analysis.summary.supAipMissingOrIncompleteCount).toBe(1);
    expect(analysis.summary.activeAtPlannedTimeCount).toBe(2);

    const byId = new Map(analysis.reconciliations.map((item) => [item.reference.id, item]));
    expect(byId.get('077/26')).toMatchObject({ status: 'conservative', mappedGeometryCount: 12, expectedGeometryCount: 12 });
    expect(byId.get('207/25')).toMatchObject({ status: 'conservative', mappedGeometryCount: 16, expectedGeometryCount: 16 });
    expect(byId.get('055/26')).toMatchObject({ status: 'partial', mappedGeometryCount: 97, expectedGeometryCount: 99 });
    expect(byId.get('055/26')?.missingGeometryNames).toEqual(['ZRT BOTTA HIGH', 'ZRT BOTTA LOW']);
  });

  it('flags a route mismatch without silently merging the two routes', async () => {
    const analysis = await analyzePibText({
      text: fixture,
      sourceKind: 'text',
      routeSnapshot: { ...route, destination: 'LFBD', routeName: 'LFBI > LFBD', signature: 'mismatch' }
    });

    expect(analysis.routeContextMode).toBe('mismatch');
    expect(analysis.warnings[0]).toContain('Aucune fusion silencieuse');
  });

  it('rejects invalid content without inventing NOTAM data', async () => {
    await expect(analyzePibText({
      text: 'Texte incomplet sans bloc NOTAM',
      sourceKind: 'text',
      routeSnapshot: route
    })).rejects.toThrow('Aucun NOTAM structuré');
  });

});
