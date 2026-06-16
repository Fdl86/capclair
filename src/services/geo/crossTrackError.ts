import type { GpsPosition } from '../../domain/gps.types';
import type { NavPoint } from '../../domain/navigation.types';
import { bearingDeg } from './bearing';
import { distanceNm } from './distance';

const EARTH_RADIUS_NM = 3440.065;
const toRad = (value: number) => (value * Math.PI) / 180;

type Side = 'gauche' | 'droite' | 'sur_route';

export interface CrossTrackResult {
  distanceNm: number;
  side: Side;
  segmentIndex: number;
  alongTrackNm: number;
}

function crossTrackForSegment(position: GpsPosition, start: NavPoint, end: NavPoint, segmentIndex: number): CrossTrackResult {
  const d13 = distanceNm(start, position) / EARTH_RADIUS_NM;
  const theta13 = toRad(bearingDeg(start, position));
  const theta12 = toRad(bearingDeg(start, end));
  const raw = Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12)) * EARTH_RADIUS_NM;
  const alongTrack = Math.acos(Math.cos(d13) / Math.cos(raw / EARTH_RADIUS_NM)) * EARTH_RADIUS_NM;
  const segmentLength = distanceNm(start, end);

  let effectiveDistance = Math.abs(raw);
  let effectiveAlongTrack = Number.isFinite(alongTrack) ? alongTrack : 0;

  if (effectiveAlongTrack < 0 || effectiveAlongTrack > segmentLength || !Number.isFinite(effectiveAlongTrack)) {
    const distStart = distanceNm(position, start);
    const distEnd = distanceNm(position, end);
    effectiveDistance = Math.min(distStart, distEnd);
    effectiveAlongTrack = distStart < distEnd ? 0 : segmentLength;
  }

  const side: Side = effectiveDistance < 0.05 ? 'sur_route' : raw > 0 ? 'droite' : 'gauche';
  return {
    distanceNm: effectiveDistance,
    side,
    segmentIndex,
    alongTrackNm: effectiveAlongTrack
  };
}

export function getCrossTrackError(position: GpsPosition | null, routePoints: NavPoint[]): CrossTrackResult {
  if (!position || routePoints.length < 2) {
    return { distanceNm: 0, side: 'sur_route', segmentIndex: 0, alongTrackNm: 0 };
  }

  let best = crossTrackForSegment(position, routePoints[0], routePoints[1], 0);
  for (let index = 1; index < routePoints.length - 1; index += 1) {
    const current = crossTrackForSegment(position, routePoints[index], routePoints[index + 1], index);
    if (current.distanceNm < best.distanceNm) best = current;
  }
  return best;
}
