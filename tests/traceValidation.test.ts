import { describe, expect, it } from 'vitest';
import { normalizeTraceRecord } from '../src/services/traces/traceValidation';

function rawPosition(latitude: number, longitude: number, timestamp: number) {
  return {
    latitude,
    longitude,
    timestamp,
    altitude: null,
    altitudeAccuracy: null,
    vitesse: null,
    track: null,
    precision: 5
  };
}

describe('stored trace validation', () => {
  it('rejects corrupt positions and invalid timestamps', () => {
    const trace = normalizeTraceRecord({
      id: 'corrupt',
      routeId: 'route',
      routeName: 'Corrupt',
      positions: [rawPosition(46, 0, 1e20), rawPosition(46, 0.01, 1e20 + 1)]
    });

    expect(trace).toBeNull();
  });

  it('normalizes legacy traces with segment-aware metrics', () => {
    const trace = normalizeTraceRecord({
      id: 'legacy',
      routeId: 'route',
      routeName: 'Legacy',
      date: '2026-07-13T10:00:00.000Z',
      positions: [
        rawPosition(46, 0, 0),
        rawPosition(46, 0.01, 5_000),
        rawPosition(47, 1, 65_000),
        rawPosition(47, 1.01, 70_000)
      ]
    });

    expect(trace).not.toBeNull();
    expect(trace?.segmentStartIndices).toEqual([2]);
    expect(trace?.dureeSec).toBe(10);
    expect(trace?.distanceNm).toBeLessThan(1.5);
  });
});
