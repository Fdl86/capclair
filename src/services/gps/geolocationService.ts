import type { GpsPosition } from '../../domain/gps.types';
import { distanceNm } from '../geo/distance';

// Au-delà de cette incertitude (mètres), un fix est trop dégradé pour être
// fiable — souvent une localisation par cellulaire/Wi-Fi plutôt qu'un vrai
// point GPS — et ne doit alimenter ni les instruments live, ni la trace.
const MAX_PLAUSIBLE_PRECISION_M = 150;

// Vitesse sol max plausible pour filtrer les sauts GPS (positions
// aberrantes) qui, sans ce garde-fou, produisent des segments de trace en
// ligne droite ne correspondant à rien de réel, au sol comme en vol.
export const MAX_TRACE_SPEED_KT = 220;

export function toGpsPosition(position: GeolocationPosition): GpsPosition {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: position.coords.altitude,
    vitesse: position.coords.speed === null ? null : position.coords.speed * 1.94384,
    track: position.coords.heading,
    timestamp: position.timestamp,
    precision: position.coords.accuracy
  };
}

export function isPlausibleGpsPosition(position: GpsPosition): boolean {
  if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) return false;
  if (position.latitude < -90 || position.latitude > 90) return false;
  if (position.longitude < -180 || position.longitude > 180) return false;
  if (position.precision !== null && position.precision > MAX_PLAUSIBLE_PRECISION_M) return false;
  return true;
}

// Point quasi identique au précédent échantillon de trace, trop rapproché
// dans le temps : redondant, sans valeur ajoutée pour le tracé. Ce n'est pas
// un point suspect, c'est le cas normal quand l'appareil est immobile ou lent.
export function isRedundantTracePoint(position: GpsPosition, previous: GpsPosition | null): boolean {
  if (!previous) return false;
  const elapsedMs = position.timestamp - previous.timestamp;
  const deltaLat = Math.abs(position.latitude - previous.latitude);
  const deltaLon = Math.abs(position.longitude - previous.longitude);
  return elapsedMs < 2500 && deltaLat < 0.00008 && deltaLon < 0.00008;
}

// Vitesse implicite entre deux positions, en noeuds. `null` si l'écart de
// temps n'est pas exploitable (paquets réordonnés, timestamp identique...).
function impliedSpeedKt(a: GpsPosition, b: GpsPosition): number | null {
  const elapsedHours = (b.timestamp - a.timestamp) / 3_600_000;
  if (elapsedHours <= 0) return null;
  return distanceNm(a, b) / elapsedHours;
}

export function isSpeedPlausible(
  position: GpsPosition,
  previous: GpsPosition | null,
  maxSpeedKt: number = MAX_TRACE_SPEED_KT
): boolean {
  if (!previous) return true;
  const speedKt = impliedSpeedKt(previous, position);
  return speedKt === null || speedKt <= maxSpeedKt;
}

export function isUsableGpsPosition(position: GpsPosition, previous: GpsPosition | null): boolean {
  if (!isPlausibleGpsPosition(position)) return false;
  if (isRedundantTracePoint(position, previous)) return false;
  if (!isSpeedPlausible(position, previous)) return false;
  return true;
}
