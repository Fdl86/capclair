import type { NavBranch, NavPoint, NavPointType, NavRoute } from '../../domain/navigation.types';
import { findAerodrome } from '../../data/aerodromeCatalog';
import { bearingDeg } from '../geo/bearing';
import { distanceNm } from '../geo/distance';
import { estimatedMagneticVariationDeg } from '../geo/magneticVariation';

const DEFAULT_SPEED_KT = 105;

function normalizeHeading(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

function midpoint(a: NavPoint, b: NavPoint) {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2
  };
}

function pointLabel(point: NavPoint): string {
  if (point.code) return point.code;
  return point.nom;
}

function pointId(type: NavPointType, code: string): string {
  return `${type}-${code.toLowerCase()}`;
}

export function createAerodromePoint(codeValue: string, type: NavPointType): NavPoint | null {
  const aerodrome = findAerodrome(codeValue);
  if (!aerodrome) return null;
  const code = aerodrome.code;
  return {
    id: pointId(type, code),
    nom: code,
    code,
    type,
    source: 'aerodrome',
    latitude: aerodrome.latitude,
    longitude: aerodrome.longitude,
    elevationFt: aerodrome.elevationFt ?? null,
    magneticVariationDeg: aerodrome.magneticVariationDeg ?? null
  };
}

export function createManualWaypoint(latitude: number, longitude: number, index: number): NavPoint {
  const code = `WP${index}`;
  return {
    id: `waypoint-${code.toLowerCase()}-${Date.now()}`,
    nom: code,
    code,
    type: 'waypoint',
    source: 'manual',
    latitude,
    longitude
  };
}

export function relabelRoutePoints(points: NavPoint[]): NavPoint[] {
  let waypointIndex = 0;
  return points.map((point, index) => {
    const type: NavPointType = index === 0 ? 'depart' : index === points.length - 1 ? 'destination' : 'waypoint';
    if (type === 'waypoint' && point.source !== 'aerodrome') {
      waypointIndex += 1;
      const code = `WP${waypointIndex}`;
      return { ...point, type, code, nom: code };
    }
    return { ...point, type, nom: point.code ?? point.nom };
  });
}

export function buildBranches(points: NavPoint[], speedKt = DEFAULT_SPEED_KT): NavBranch[] {
  return points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    const distance = distanceNm(point, next);
    const routeVraie = normalizeHeading(bearingDeg(point, next));
    const mid = midpoint(point, next);
    const magneticVariationDeg = estimatedMagneticVariationDeg(mid.latitude, mid.longitude);
    const routeMagnetique = normalizeHeading(routeVraie - magneticVariationDeg);
    const tempsBrancheMin = Math.max(1, Math.round((distance / speedKt) * 60));

    return {
      id: `${point.id}-${next.id}`,
      from: point.id,
      to: next.id,
      distanceNm: Number(distance.toFixed(1)),
      routeVraie,
      magneticVariationDeg,
      routeMagnetique,
      derive: 0,
      capCorrige: routeMagnetique,
      vitesseSol: speedKt,
      tempsBrancheMin
    };
  });
}

export function buildRoute(points: NavPoint[], speedKt = DEFAULT_SPEED_KT): NavRoute {
  const normalizedPoints = relabelRoutePoints(points);
  const branches = buildBranches(normalizedPoints, speedKt);
  const departure = normalizedPoints[0];
  const destination = normalizedPoints[normalizedPoints.length - 1];

  return {
    id: 'active-route',
    nom: `${pointLabel(departure)} - ${pointLabel(destination)}`,
    points: normalizedPoints,
    branches,
    distanceTotale: Number(branches.reduce((sum, branch) => sum + branch.distanceNm, 0).toFixed(1)),
    tempsEstimeMin: branches.reduce((sum, branch) => sum + branch.tempsBrancheMin, 0),
    vitesseSolKt: speedKt,
    dateModification: new Date().toISOString()
  };
}

export function createDefaultRoute(): NavRoute {
  const departure = createAerodromePoint('LFBI', 'depart');
  const waypoint = createAerodromePoint('LFOD', 'waypoint');
  const destination = createAerodromePoint('LFEY', 'destination');

  if (!departure || !waypoint || !destination) {
    throw new Error('Default aerodromes missing from catalogue');
  }

  return buildRoute([departure, waypoint, destination]);
}
