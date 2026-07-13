import { describe, expect, it } from 'vitest';
import type { Trace } from '../src/domain/trace.types';
import { splitTraceSegments, traceToGpx } from '../src/services/export/gpxExport';

const trace: Trace = {
  id: 'gpx-test',
  routeId: 'route-test',
  routeName: 'GPX test',
  date: '2026-07-13T10:00:00.000Z',
  source: 'gpx-import',
  timingMode: 'recorded',
  positions: [
    { latitude: 46, longitude: 0, timestamp: 0, altitude: 100, altitudeAccuracy: 5, vitesse: null, track: null, precision: 5 },
    { latitude: 46, longitude: 0.01, timestamp: 13_000, altitude: 101, altitudeAccuracy: 5, vitesse: null, track: null, precision: 5 }
  ],
  dureeSec: 13,
  distanceNm: 0.4,
  importMetadata: {
    fileName: 'large.gpx',
    importedAt: '2026-07-13T10:00:00.000Z',
    kind: 'track',
    originalPointCount: 50_000,
    discardedPointCount: 0,
    optimizedPointCount: 25_000,
    hadCompleteTimestamps: true
  }
};

describe('GPX export segmentation', () => {
  it('uses the shared 15 second gap threshold and exports optimization metadata', () => {
    expect(splitTraceSegments(trace)).toHaveLength(1);
    const xml = traceToGpx(trace);
    expect(xml.match(/<trkseg>/g)).toHaveLength(1);
    expect(xml).toContain('<capclair:optimizedPointCount>25000</capclair:optimizedPointCount>');
  });
});
