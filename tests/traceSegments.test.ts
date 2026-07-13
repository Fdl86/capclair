import { describe, expect, it } from 'vitest';
import type { GpsPosition } from '../src/domain/gps.types';
import { compactSegmentedTrace, computeTraceMetrics } from '../src/services/traces/traceSegments';

function point(latitude: number, longitude: number, timestamp: number): GpsPosition {
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

describe('trace segmentation and metrics', () => {
  it('excludes distance and duration across a GPS gap', () => {
    const positions = [
      point(46, 0, 0),
      point(46, 0.01, 5_000),
      point(47, 1, 65_000),
      point(47, 1.01, 70_000)
    ];

    const metrics = computeTraceMetrics(positions);

    expect(metrics.segmentStartIndices).toEqual([2]);
    expect(metrics.durationSec).toBe(10);
    expect(metrics.distanceNm).toBeGreaterThan(0.5);
    expect(metrics.distanceNm).toBeLessThan(1.5);
  });

  it('compacts a long trace while preserving every segment boundary', () => {
    const positions = Array.from({ length: 1_000 }, (_, index) =>
      point(46 + index * 0.00001, index < 500 ? index * 0.00001 : 1 + index * 0.00001, index * 3_000)
    );

    const compacted = compactSegmentedTrace(positions, [500], 120);

    expect(compacted.compacted).toBe(true);
    expect(compacted.positions.length).toBeLessThanOrEqual(120);
    expect(compacted.positions[0]).toEqual(positions[0]);
    expect(compacted.positions.at(-1)).toEqual(positions.at(-1));
    expect(compacted.segmentStartIndices).toHaveLength(1);
    const secondStart = compacted.segmentStartIndices[0];
    expect(compacted.positions[secondStart]).toEqual(positions[500]);
  });
});
