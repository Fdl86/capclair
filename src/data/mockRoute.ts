import type { NavBranch, NavPoint, NavRoute } from '../domain/navigation.types';
import { bearingDeg } from '../services/geo/bearing';
import { distanceNm } from '../services/geo/distance';

export const mockPoints: NavPoint[] = [
  { id: 'lfbi', nom: 'LFBI', type: 'depart', latitude: 46.5877, longitude: 0.3067 },
  { id: 'wpt1', nom: 'POITIERS NORD', type: 'waypoint', latitude: 46.7200, longitude: 0.3300 },
  { id: 'lfca', nom: 'LFCA', type: 'waypoint', latitude: 46.8150, longitude: 0.5450 },
  { id: 'wpt2', nom: 'CHAUVIGNY', type: 'waypoint', latitude: 46.5750, longitude: 0.6500 },
  { id: 'lfbi-retour', nom: 'LFBI', type: 'destination', latitude: 46.5877, longitude: 0.3067 }
];

export function buildBranches(points: NavPoint[]): NavBranch[] {
  return points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    const distance = distanceNm(point, next);
    const routeVraie = Math.round(bearingDeg(point, next));
    const derive = [-4, -2, 3, 1][index] ?? 0;
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
    id: 'route-demo-poitiers-local',
    nom: 'Test Poitiers - LFBI / LFCA',
    points,
    branches,
    distanceTotale: Number(branches.reduce((sum, branch) => sum + branch.distanceNm, 0).toFixed(1)),
    tempsEstimeMin: branches.reduce((sum, branch) => sum + branch.tempsBrancheMin, 0),
    dateModification: new Date().toISOString()
  };
}

export const mockRoute = buildRoute();
