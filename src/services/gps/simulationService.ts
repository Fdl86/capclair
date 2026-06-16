import type { GpsPosition } from '../../domain/gps.types';
import type { NavPoint } from '../../domain/navigation.types';
import { bearingDeg } from '../geo/bearing';

export function interpolateSimulationPoint(routePoints: NavPoint[], step: number): GpsPosition {
  const segmentCount = Math.max(1, routePoints.length - 1);
  const normalized = (step % (segmentCount * 18)) / 18;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(normalized));
  const localT = normalized - segmentIndex;
  const start = routePoints[segmentIndex];
  const end = routePoints[segmentIndex + 1];
  const offset = Math.sin(step / 5) * 0.018;

  return {
    latitude: start.latitude + (end.latitude - start.latitude) * localT + offset,
    longitude: start.longitude + (end.longitude - start.longitude) * localT - offset * 0.5,
    altitude: 1050 + Math.sin(step / 4) * 40,
    vitesse: 102 + Math.sin(step / 6) * 3,
    track: bearingDeg(start, end),
    timestamp: Date.now(),
    precision: 18
  };
}
