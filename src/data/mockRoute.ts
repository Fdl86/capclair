import type { NavBranch, NavPoint, NavRoute } from '../domain/navigation.types';
import { bearingDeg } from '../services/geo/bearing';
import { distanceNm } from '../services/geo/distance';

export const mockPoints: NavPoint[] = [
  { id: 'lfca', nom: 'LFCA', type: 'depart', latitude: 46.780278, longitude: 0.550556 },
  { id: 'lfod', nom: 'LFOD SAUMUR', type: 'waypoint', latitude: 47.256667, longitude: -0.113611 },
  { id: 'lfot', nom: 'LFOT TOURS', type: 'destination', latitude: 47.431944, longitude: 0.723056 }
];

export function buildBranches(points: NavPoint[]): NavBranch[] {
  return points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    const distance = distanceNm(point, next);
    const routeVraie = Math.round(bearingDeg(point, next));
    const derive = [-3, 2][index] ?? 0;
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
    id: 'route-demo-lfca-lfod-lfot',
    nom: 'LFCA - LFOD Saumur - LFOT Tours',
    points,
    branches,
    distanceTotale: Number(branches.reduce((sum, branch) => sum + branch.distanceNm, 0).toFixed(1)),
    tempsEstimeMin: branches.reduce((sum, branch) => sum + branch.tempsBrancheMin, 0),
    dateModification: new Date().toISOString()
  };
}

export const mockRoute = buildRoute();
