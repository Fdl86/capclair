import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import fixture from '../../src/services/notam/__fixtures__/sofia-lfbi-lfou.txt?raw';
import type { BriefingRouteSnapshot } from '../../src/domain/notam.types';
import { analyzePibText } from '../../src/services/notam/pibAnalysis';
import { createNotamPibLayer, notamPibSelectionFromFeature, updateNotamPibLayer } from '../../src/mapLayers/notamPibLayer';

const route: BriefingRouteSnapshot = {
  routeId: 'map-test',
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
  signature: 'map-fixture'
};

async function readJson(relativePath: string) {
  return JSON.parse(await readFile(new URL(`../../public/data/${relativePath}`, import.meta.url), 'utf8'));
}

describe('NOTAM PIB OpenLayers layer', () => {
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
      return payload
        ? new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
        : new Response('Not found', { status: 404 });
    }));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('uses exact SUP geometries, keeps LFDB21Z and limits repeated Q labels to active schedules', async () => {
    const analysis = await analyzePibText({ text: fixture, sourceKind: 'text', routeSnapshot: route });
    const layer = createNotamPibLayer();
    const count = await updateNotamPibLayer(layer, analysis, { enabled: true, filter: 'all' });
    const features = layer.getSource()?.getFeatures() ?? [];
    const selections = features.map(notamPibSelectionFromFeature).filter(Boolean);

    expect(count).toBe(features.length);
    expect(selections.filter((item) => item?.kind === 'sup-exact')).toHaveLength(125);
    expect(selections.some((item) => item?.notamId === 'LFFA-R1871/26' && item.kind === 'e-polygon')).toBe(true);
    expect(selections.filter((item) => item?.notamId === 'LFFA-R1880/26' && item.kind === 'sup-exact')).toHaveLength(97);
    expect(selections.some((item) => item?.notamId === 'LFFA-R1880/26' && item.kind === 'q-approximation')).toBe(false);
    expect(selections.filter((item) => item?.kind === 'q-approximation').every((item) => item?.warning?.includes('approximative'))).toBe(true);

    const qApproximationFeatures = features.filter((feature) => feature.get('kind') === 'q-approximation');
    const labelledQFeatures = qApproximationFeatures.filter((feature) => feature.get('showApproximationLabel') === true);
    expect(labelledQFeatures).toHaveLength(2);
    expect(labelledQFeatures.map((feature) => notamPibSelectionFromFeature(feature)?.notamId).sort()).toEqual(['LFFA-F1552/26', 'LFFA-F1558/26']);

    layer.dispose();
  });
});
