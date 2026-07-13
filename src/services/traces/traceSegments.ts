import type { GpsPosition } from '../../domain/gps.types';
import { distanceNm } from '../geo/distance';

export const TRACE_GAP_BREAK_MS = 15_000;

export interface TraceMetrics {
  distanceNm: number;
  durationSec: number;
  segmentStartIndices: number[];
}

function validStartIndices(indices: number[] | undefined, pointCount: number): number[] {
  if (!indices?.length || pointCount < 2) return [];
  return [...new Set(indices)]
    .filter((index) => Number.isInteger(index) && index > 0 && index < pointCount)
    .sort((a, b) => a - b);
}

export function deriveSegmentStartIndices(
  positions: GpsPosition[],
  explicitStarts: number[] = [],
  useTimestampGaps = true,
  gapBreakMs = TRACE_GAP_BREAK_MS
): number[] {
  const starts = new Set(validStartIndices(explicitStarts, positions.length));
  if (useTimestampGaps) {
    for (let index = 1; index < positions.length; index += 1) {
      const delta = positions[index].timestamp - positions[index - 1].timestamp;
      if (!Number.isFinite(delta) || delta <= 0 || delta > gapBreakMs) starts.add(index);
    }
  }
  return [...starts].sort((a, b) => a - b);
}

export function computeTraceMetrics(
  positions: GpsPosition[],
  explicitStarts: number[] = [],
  useTimestampGaps = true,
  gapBreakMs = TRACE_GAP_BREAK_MS
): TraceMetrics {
  const segmentStartIndices = deriveSegmentStartIndices(positions, explicitStarts, useTimestampGaps, gapBreakMs);
  const starts = new Set(segmentStartIndices);
  let totalDistance = 0;
  let activeDurationMs = 0;

  for (let index = 1; index < positions.length; index += 1) {
    if (starts.has(index)) continue;
    const legDistance = distanceNm(positions[index - 1], positions[index]);
    if (Number.isFinite(legDistance)) totalDistance += legDistance;
    const delta = positions[index].timestamp - positions[index - 1].timestamp;
    if (Number.isFinite(delta) && delta > 0) activeDurationMs += delta;
  }

  return {
    distanceNm: totalDistance,
    durationSec: Math.round(activeDurationMs / 1000),
    segmentStartIndices
  };
}

export interface CompactedTrace {
  positions: GpsPosition[];
  segmentStartIndices: number[];
  compacted: boolean;
}

/**
 * Réduit progressivement une longue trace tout en conservant le premier et le
 * dernier point de chaque segment. Les points récents ne sont pas supprimés en
 * bloc : l'historique complet reste représenté, avec une densité moindre.
 */
export function compactSegmentedTrace(
  positions: GpsPosition[],
  segmentStartIndices: number[],
  maxPoints: number
): CompactedTrace {
  if (positions.length <= maxPoints || maxPoints < 4) {
    return {
      positions,
      segmentStartIndices: validStartIndices(segmentStartIndices, positions.length),
      compacted: false
    };
  }

  const starts = [0, ...validStartIndices(segmentStartIndices, positions.length)];
  const segmentRanges = starts.map((start, index) => ({
    start,
    end: (starts[index + 1] ?? positions.length) - 1
  })).filter((range) => range.end >= range.start);

  let stride = 2;
  let selected: number[] = [];
  do {
    const keep = new Set<number>();
    for (const range of segmentRanges) {
      keep.add(range.start);
      keep.add(range.end);
      for (let index = range.start + stride; index < range.end; index += stride) keep.add(index);
    }
    selected = [...keep].sort((a, b) => a - b);
    stride += 1;
  } while (selected.length > maxPoints && stride <= positions.length);

  if (selected.length > maxPoints) {
    selected = selected.filter((_, index) => index === 0 || index === selected.length - 1 || index % Math.ceil(selected.length / maxPoints) === 0);
    selected = selected.slice(0, maxPoints - 1).concat(selected.at(-1)!);
  }

  const oldToNew = new Map<number, number>();
  selected.forEach((oldIndex, newIndex) => oldToNew.set(oldIndex, newIndex));
  const nextStarts = segmentRanges
    .slice(1)
    .map((range) => oldToNew.get(range.start))
    .filter((index): index is number => typeof index === 'number' && index > 0);

  return {
    positions: selected.map((index) => positions[index]),
    segmentStartIndices: nextStarts,
    compacted: true
  };
}
