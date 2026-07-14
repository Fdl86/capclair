import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import { fromLonLat, toLonLat } from 'ol/proj';
import type { NavPoint } from '../../domain/navigation.types';
import type { SupAipDisplayMode } from '../../domain/supaip.types';
import type { SupAipLayer } from '../../mapLayers/supAipLayer';
import { distanceNm } from '../geo/distance';

export interface SupAipVisibilitySettings {
  mode: SupAipDisplayMode;
  routeCorridorNm: number;
  endpointRadiusNm: number;
}

export const DEFAULT_SUP_AIP_VISIBILITY_SETTINGS: SupAipVisibilitySettings = {
  mode: 'route',
  routeCorridorNm: 15,
  endpointRadiusNm: 25
};

export const SUP_AIP_CORRIDOR_MIN_NM = 5;
export const SUP_AIP_CORRIDOR_MAX_NM = 50;
export const SUP_AIP_ENDPOINT_MIN_NM = 5;
export const SUP_AIP_ENDPOINT_MAX_NM = 50;

interface GeoPoint {
  latitude: number;
  longitude: number;
}

const SAMPLE_STEP_NM = 1;
const MAX_INPUT_POINTS = 600;
const MAX_SAMPLES = 4000;
const VISIBILITY_PROPERTY = 'capclairSupAipVisible';

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function normalizeSupAipVisibilitySettings(value: Partial<SupAipVisibilitySettings> | null | undefined): SupAipVisibilitySettings {
  const mode: SupAipDisplayMode = value?.mode === 'off' || value?.mode === 'all' || value?.mode === 'route'
    ? value.mode
    : DEFAULT_SUP_AIP_VISIBILITY_SETTINGS.mode;

  return {
    mode,
    routeCorridorNm: clamp(
      Number(value?.routeCorridorNm),
      SUP_AIP_CORRIDOR_MIN_NM,
      SUP_AIP_CORRIDOR_MAX_NM,
      DEFAULT_SUP_AIP_VISIBILITY_SETTINGS.routeCorridorNm
    ),
    endpointRadiusNm: clamp(
      Number(value?.endpointRadiusNm),
      SUP_AIP_ENDPOINT_MIN_NM,
      SUP_AIP_ENDPOINT_MAX_NM,
      DEFAULT_SUP_AIP_VISIBILITY_SETTINGS.endpointRadiusNm
    )
  };
}

export function nextSupAipDisplayMode(mode: SupAipDisplayMode): SupAipDisplayMode {
  if (mode === 'off') return 'route';
  if (mode === 'route') return 'all';
  return 'off';
}

function reduceInputPoints(points: GeoPoint[]): GeoPoint[] {
  if (points.length <= MAX_INPUT_POINTS) return points;
  const stride = Math.ceil(points.length / MAX_INPUT_POINTS);
  const reduced = points.filter((_, index) => index % stride === 0);
  const last = points.at(-1);
  if (last && reduced.at(-1) !== last) reduced.push(last);
  return reduced;
}

function sampleRoute(points: GeoPoint[]): GeoPoint[] {
  const input = reduceInputPoints(points);
  if (input.length <= 1) return input;

  const samples: GeoPoint[] = [];
  for (let index = 1; index < input.length; index += 1) {
    const start = input[index - 1];
    const end = input[index];
    const segmentDistanceNm = distanceNm(start, end);
    const steps = Math.max(1, Math.ceil(segmentDistanceNm / SAMPLE_STEP_NM));

    for (let step = 0; step < steps; step += 1) {
      if (samples.length >= MAX_SAMPLES) return samples;
      const ratio = step / steps;
      samples.push({
        latitude: start.latitude + (end.latitude - start.latitude) * ratio,
        longitude: start.longitude + (end.longitude - start.longitude) * ratio
      });
    }
  }

  const last = input.at(-1);
  if (last && samples.length < MAX_SAMPLES) samples.push(last);
  return samples;
}

function distanceFromGeometryNm(geometry: Geometry, point: GeoPoint): number {
  const projectedPoint = fromLonLat([point.longitude, point.latitude]);
  const closestProjected = geometry.getClosestPoint(projectedPoint);
  const [longitude, latitude] = toLonLat(closestProjected);
  return distanceNm(point, { latitude, longitude });
}

function featureMatchesRoute(
  feature: Feature<Geometry>,
  routeSamples: GeoPoint[],
  endpointPoints: GeoPoint[],
  settings: SupAipVisibilitySettings
): boolean {
  const geometry = feature.getGeometry();
  if (!geometry) return false;

  for (const endpoint of endpointPoints) {
    if (distanceFromGeometryNm(geometry, endpoint) <= settings.endpointRadiusNm) return true;
  }

  for (const sample of routeSamples) {
    if (distanceFromGeometryNm(geometry, sample) <= settings.routeCorridorNm) return true;
  }

  return false;
}

export function isSupAipFeatureVisible(feature: Feature<Geometry>): boolean {
  return feature.get(VISIBILITY_PROPERTY) !== false;
}

export function applySupAipVisibility(
  layer: SupAipLayer,
  routePoints: Array<Pick<NavPoint, 'latitude' | 'longitude'>>,
  rawSettings: SupAipVisibilitySettings
): number {
  const settings = normalizeSupAipVisibilitySettings(rawSettings);
  const features = layer.getSource()?.getFeatures() ?? [];
  const points = routePoints
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    .map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
  const routeSamples = settings.mode === 'route' ? sampleRoute(points) : [];
  const endpointPoints = points.length > 0 ? [points[0], points.at(-1)!] : [];
  let visibleCount = 0;

  for (const feature of features) {
    const visible = settings.mode === 'all'
      || (settings.mode === 'route' && points.length > 0 && featureMatchesRoute(feature, routeSamples, endpointPoints, settings));
    feature.set(VISIBILITY_PROPERTY, visible, true);
    if (visible) visibleCount += 1;
  }

  layer.setVisible(settings.mode !== 'off');
  layer.changed();
  return visibleCount;
}
