import { useMemo, useState } from 'react';
import type { NavPoint, NavRoute } from '../domain/navigation.types';
import { buildRoute, mockRoute } from '../data/mockRoute';
import { useLocalStorageState } from './useLocalStorageState';

function createMockPoint(index: number): NavPoint {
  return {
    id: `wpt-local-${Date.now()}`,
    nom: `WPT${index}`,
    type: 'waypoint',
    latitude: 45.7 + index * 0.08,
    longitude: -0.05 + index * 0.12
  };
}

export function useActiveRoute() {
  const [route, setRoute] = useLocalStorageState<NavRoute>('capclair.activeRoute', mockRoute);
  const [selectedPointId, setSelectedPointId] = useState(route.points[1]?.id ?? route.points[0]?.id ?? null);

  const selectedPoint = useMemo(() => route.points.find((point) => point.id === selectedPointId) ?? null, [route.points, selectedPointId]);

  const updatePoints = (points: NavPoint[]) => {
    setRoute({ ...buildRoute(points), id: route.id, nom: route.nom, dateModification: new Date().toISOString() });
  };

  const addMockPoint = () => {
    const insertIndex = Math.max(1, route.points.length - 1);
    const nextWaypointNumber = route.points.filter((point) => point.type === 'waypoint').length + 1;
    const points = [...route.points];
    const point = createMockPoint(nextWaypointNumber);
    points.splice(insertIndex, 0, point);
    updatePoints(points.map((item, index) => item.type === 'waypoint' ? { ...item, nom: `WPT${index}` } : item));
    setSelectedPointId(point.id);
  };

  const removePoint = (pointId: string) => {
    const point = route.points.find((item) => item.id === pointId);
    if (!point || point.type !== 'waypoint') return;
    const points = route.points.filter((item) => item.id !== pointId);
    updatePoints(points);
    setSelectedPointId(points[1]?.id ?? points[0]?.id ?? null);
  };

  const resetRoute = () => {
    setRoute(mockRoute);
    setSelectedPointId(mockRoute.points[1]?.id ?? mockRoute.points[0].id);
  };

  return {
    route,
    selectedPoint,
    selectedPointId,
    setSelectedPointId,
    addMockPoint,
    removePoint,
    resetRoute
  };
}
