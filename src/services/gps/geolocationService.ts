import type { GpsPosition } from '../../domain/gps.types';

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
  if (position.precision !== null && position.precision > 300) return false;
  return true;
}

export function isUsableGpsPosition(position: GpsPosition, previous: GpsPosition | null): boolean {
  if (!isPlausibleGpsPosition(position)) return false;
  if (!previous) return true;
  const elapsedMs = position.timestamp - previous.timestamp;
  const deltaLat = Math.abs(position.latitude - previous.latitude);
  const deltaLon = Math.abs(position.longitude - previous.longitude);
  if (elapsedMs < 2500 && deltaLat < 0.00008 && deltaLon < 0.00008) return false;
  return true;
}
