import type { NavPoint, NavRoute } from '../../domain/navigation.types';
import { distanceNm } from '../geo/distance';

export interface TerrainSample {
  distanceRatio: number;
  elevationFt: number;
}

interface TerrainApiResponse {
  elevations?: number[];
}

interface GeoPoint {
  latitude: number;
  longitude: number;
  distanceRatio: number;
}

const TERRAIN_SAMPLE_COUNT = 60;
const METERS_TO_FEET = 3.28084;
const terrainCache = new Map<string, TerrainSample[]>();

function routeKey(route: NavRoute): string {
  const pointsKey = route.points
    .map((point) => `${point.id}:${point.latitude.toFixed(4)}:${point.longitude.toFixed(4)}`)
    .join('|');
  return `${pointsKey}:${route.distanceTotale.toFixed(2)}`;
}

function interpolatePoint(from: NavPoint, to: NavPoint, ratio: number): Pick<NavPoint, 'latitude' | 'longitude'> {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * ratio,
    longitude: from.longitude + (to.longitude - from.longitude) * ratio
  };
}

function buildRouteSamples(route: NavRoute): GeoPoint[] {
  if (route.points.length < 2 || route.distanceTotale <= 0) return [];

  const segmentDistances = route.points.slice(0, -1).map((point, index) => distanceNm(point, route.points[index + 1]));
  const totalDistance = segmentDistances.reduce((sum, distance) => sum + distance, 0);
  if (!Number.isFinite(totalDistance) || totalDistance <= 0) return [];

  const sampleCount = Math.max(2, TERRAIN_SAMPLE_COUNT);
  const samples: GeoPoint[] = [];

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const distanceRatio = sampleIndex / (sampleCount - 1);
    const targetDistance = totalDistance * distanceRatio;
    let segmentStartDistance = 0;

    for (let segmentIndex = 0; segmentIndex < segmentDistances.length; segmentIndex += 1) {
      const segmentDistance = segmentDistances[segmentIndex];
      const segmentEndDistance = segmentStartDistance + segmentDistance;
      const isLastSegment = segmentIndex === segmentDistances.length - 1;

      if (targetDistance <= segmentEndDistance || isLastSegment) {
        const localRatio = segmentDistance > 0 ? Math.min(1, Math.max(0, (targetDistance - segmentStartDistance) / segmentDistance)) : 0;
        const point = interpolatePoint(route.points[segmentIndex], route.points[segmentIndex + 1], localRatio);
        samples.push({ ...point, distanceRatio });
        break;
      }

      segmentStartDistance = segmentEndDistance;
    }
  }

  return samples;
}

function parseTerrainResponse(payload: TerrainApiResponse, samples: GeoPoint[]): TerrainSample[] {
  const elevations = Array.isArray(payload.elevations) ? payload.elevations : [];
  if (elevations.length !== samples.length) return [];

  return elevations
    .map((meters, index): TerrainSample | null => {
      if (!Number.isFinite(meters) || meters <= -9000) return null;
      const elevationFt = Math.max(0, Math.round(meters * METERS_TO_FEET));
      return {
        distanceRatio: samples[index].distanceRatio,
        elevationFt
      };
    })
    .filter((sample): sample is TerrainSample => sample !== null);
}

export async function fetchTerrainProfile(route: NavRoute): Promise<TerrainSample[]> {
  const key = routeKey(route);
  const cached = terrainCache.get(key);
  if (cached) return cached;

  try {
    const samples = buildRouteSamples(route);
    if (!samples.length) {
      terrainCache.set(key, []);
      return [];
    }

    const lon = samples.map((sample) => sample.longitude.toFixed(6)).join('|');
    const lat = samples.map((sample) => sample.latitude.toFixed(6)).join('|');
    const response = await fetch(`/api/ign/elevation?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}`, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      terrainCache.set(key, []);
      return [];
    }

    const payload = (await response.json()) as TerrainApiResponse;
    const profile = parseTerrainResponse(payload, samples);
    terrainCache.set(key, profile);
    return profile;
  } catch {
    terrainCache.set(key, []);
    return [];
  }
}
