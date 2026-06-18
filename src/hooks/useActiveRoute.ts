import { useMemo, useState } from 'react';
import type { NavPoint, NavRoute } from '../domain/navigation.types';
import { useLocalStorageState } from './useLocalStorageState';
import { buildRoute, createAerodromePoint, createDefaultRoute, createManualWaypoint, relabelRoutePoints } from '../services/navigation/routeBuilder';

const STORAGE_KEY = 'capclair.activeRoute.dev12.routeBuilder';
const defaultRoute = createDefaultRoute();

function safeRoute(route: NavRoute): NavRoute {
  if (!route.points || route.points.length < 2) return defaultRoute;
  return buildRoute(route.points, route.vitesseSolKt || defaultRoute.vitesseSolKt);
}

export function useActiveRoute() {
  const [route, setRoute] = useLocalStorageState<NavRoute>(STORAGE_KEY, defaultRoute);
  const [selectedPointId, setSelectedPointId] = useState(route.points[1]?.id ?? route.points[0]?.id ?? null);
  const [routeMessage, setRouteMessage] = useState('Route prête');

  const normalizedRoute = useMemo(() => safeRoute(route), [route]);
  const selectedPoint = useMemo(() => normalizedRoute.points.find((point) => point.id === selectedPointId) ?? null, [normalizedRoute.points, selectedPointId]);

  const commitPoints = (points: NavPoint[], message = 'Route mise à jour') => {
    const nextRoute = buildRoute(relabelRoutePoints(points), normalizedRoute.vitesseSolKt);
    setRoute(nextRoute);
    setRouteMessage(message);
  };

  const setDepartureCode = (code: string): boolean => {
    const point = createAerodromePoint(code, 'depart');
    if (!point) {
      setRouteMessage(`Code départ inconnu : ${code.trim().toUpperCase()}`);
      return false;
    }
    const nextPoints = [point, ...normalizedRoute.points.slice(1)];
    commitPoints(nextPoints, `Départ ${point.code}`);
    setSelectedPointId(point.id);
    return true;
  };

  const setDestinationCode = (code: string): boolean => {
    const point = createAerodromePoint(code, 'destination');
    if (!point) {
      setRouteMessage(`Code arrivée inconnu : ${code.trim().toUpperCase()}`);
      return false;
    }
    const nextPoints = [...normalizedRoute.points.slice(0, -1), point];
    commitPoints(nextPoints, `Arrivée ${point.code}`);
    setSelectedPointId(point.id);
    return true;
  };

  const addWaypointAt = (longitude: number, latitude: number) => {
    const insertIndex = Math.max(1, normalizedRoute.points.length - 1);
    const nextWaypointNumber = normalizedRoute.points.filter((point) => point.type === 'waypoint' && point.source !== 'aerodrome').length + 1;
    const point = createManualWaypoint(latitude, longitude, nextWaypointNumber);
    const points = [...normalizedRoute.points];
    points.splice(insertIndex, 0, point);
    commitPoints(points, `${point.code} ajouté`);
    setSelectedPointId(point.id);
  };

  const removePoint = (pointId: string) => {
    const point = normalizedRoute.points.find((item) => item.id === pointId);
    if (!point || point.type !== 'waypoint') return;
    const points = normalizedRoute.points.filter((item) => item.id !== pointId);
    commitPoints(points, `${point.code ?? point.nom} supprimé`);
    setSelectedPointId(points[1]?.id ?? points[0]?.id ?? null);
  };

  const reverseRoute = () => {
    const points = normalizedRoute.points.slice().reverse().map((point, index, array) => ({
      ...point,
      type: index === 0 ? 'depart' as const : index === array.length - 1 ? 'destination' as const : 'waypoint' as const,
      id: `${index === 0 ? 'depart' : index === array.length - 1 ? 'destination' : 'waypoint'}-${point.code?.toLowerCase() ?? point.id}`
    }));
    commitPoints(points, 'Route inversée');
    setSelectedPointId(points[1]?.id ?? points[0]?.id ?? null);
  };

  const resetRoute = () => {
    setRoute(defaultRoute);
    setSelectedPointId(defaultRoute.points[1]?.id ?? defaultRoute.points[0].id);
    setRouteMessage('Route exemple restaurée');
  };

  return {
    route: normalizedRoute,
    selectedPoint,
    selectedPointId,
    routeMessage,
    setSelectedPointId,
    setDepartureCode,
    setDestinationCode,
    addWaypointAt,
    removePoint,
    reverseRoute,
    resetRoute
  };
}
