import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NavRoute } from '../src/domain/navigation.types';
import { fetchWindAloftForRoute } from '../src/services/weather/windAloftClient';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function route(branchId: string): NavRoute {
  return {
    id: `route-${branchId}`,
    nom: branchId,
    points: [
      { id: 'from', nom: 'FROM', type: 'depart', latitude: 46.58, longitude: 0.30 },
      { id: 'to', nom: 'TO', type: 'destination', latitude: 46.62, longitude: 0.34 }
    ],
    branches: [{
      id: branchId,
      from: 'from',
      to: 'to',
      distanceNm: 10,
      routeVraie: 90,
      magneticVariationDeg: 0,
      routeMagnetique: 90,
      altitudeFt: 2500,
      wind: null,
      derive: 0,
      capVrai: 90,
      capCorrige: 90,
      vitesseSol: 95,
      tempsSansVentMin: 6,
      tempsBrancheMin: 6,
      estimatedStartIso: '2026-07-13T10:00:00.000Z',
      estimatedMidIso: '2026-07-13T10:03:00.000Z',
      estimatedArrivalIso: '2026-07-13T10:06:00.000Z'
    }],
    distanceTotale: 10,
    tempsEstimeMin: 6,
    vitesseSolKt: 95,
    profile: { tasKt: 95, defaultAltitudeFt: 2500, departureTimeIso: '2026-07-13T10:00:00.000Z' },
    branchAltitudeById: { [branchId]: 2500 },
    branchWindById: {},
    dateModification: '2026-07-13T09:00:00.000Z'
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('wind aloft browser cache', () => {
  it('rebinds a shared cached weather cell to every requesting branch', async () => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage, setTimeout });

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { samples: Array<{ sampleId: string; branchId: string }> };
      const sample = body.samples[0];
      return new Response(JSON.stringify({
        source: 'open-meteo-meteofrance-strict',
        generatedAt: '2026-07-13T09:00:00.000Z',
        samples: [{
          sampleId: sample.sampleId,
          branchId: sample.branchId,
          normalizedKey: 'shared-cell',
          directionDeg: 270,
          speedKt: 15,
          cache: 'live'
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const analysisTime = '2026-07-13T10:15:00.000Z';
    const first = await fetchWindAloftForRoute(route('branch-a'), analysisTime);
    const second = await fetchWindAloftForRoute(route('branch-b'), analysisTime);

    expect(first['branch-a']).toMatchObject({ directionDeg: 270, speedKt: 15 });
    expect(second['branch-b']).toMatchObject({ directionDeg: 270, speedKt: 15, cache: 'browser' });
    expect(second['branch-a']).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
