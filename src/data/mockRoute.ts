import type { NavBranch, NavPoint, NavRoute } from '../domain/navigation.types';
import { bearingDeg } from '../services/geo/bearing';
import { distanceNm } from '../services/geo/distance';

export const mockPoints: NavPoint[] = [
  { id: 'lfbd', nom: 'LFBD', type: 'depart', latitude: 44.8283, longitude: -0.7156 },
  { id: 'wpt1', nom: 'WPT1', type: 'waypoint', latitude: 45.3850, longitude: -0.1450 },
  { id: 'wpt2', nom: 'WPT2', type: 'waypoint', latitude: 45.9250, longitude: 0.1800 },
  { id: 'wpt3', nom: 'WPT3', type: 'waypoint', latitude: 46.3100, longitude: 0.1450 },
  { id: 'lfeh', nom: 'LFEH', type: 'destination', latitude: 46.5850, longitude: 0.3150 }
];

export function buildBranches(points: NavPoint[]): NavBranch[] {
  return points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    const distance = distanceNm(point, next);
    const routeVraie = Math.round(bearingDeg(point, next));
    const derive = [-4, -3, -2, -1][index] ?? 0;
    const vitesseSol = 102;
    const tempsBrancheMin = Math.max(1, Math.round((distance / vitesseSol) * 60));
    return {
      id: `${point.id}-${next.id}`,
      from: point.id,
      to: next.id,
      distanceNm: Number(distance.toFixed(1)),
      routeVraie,
      derive,
      capCorrige: (routeVraie + derive + 360) % 360,
      vitesseSol,
      tempsBrancheMin
    };
  });
}

export function buildRoute(points: NavPoint[] = mockPoints): NavRoute {
  const branches = buildBranches(points);
  return {
    id: 'route-demo-lfbd-lfeh',
    nom: 'LFBD - LFEH',
    points,
    branches,
    distanceTotale: Number(branches.reduce((sum, branch) => sum + branch.distanceNm, 0).toFixed(1)),
    tempsEstimeMin: branches.reduce((sum, branch) => sum + branch.tempsBrancheMin, 0),
    dateModification: new Date().toISOString()
  };
}

export const mockRoute = buildRoute();
