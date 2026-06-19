import { useMemo, useState } from 'react';
import type { BranchWind, FlightProfile, NavPoint, NavRoute } from '../domain/navigation.types';
import { useLocalStorageState } from './useLocalStorageState';
import { buildRoute, createAerodromePoint, createDefaultRoute, createManualWaypoint, relabelRoutePoints } from '../services/navigation/routeBuilder';
import { fetchWindAloftForRoute } from '../services/weather/windAloftClient';

const STORAGE_KEY = 'capclair.activeRoute.dev13.windLog';
const defaultRoute = createDefaultRoute();

function safeRoute(route: NavRoute): NavRoute {
  if (!route.points || route.points.length < 2) return defaultRoute;
  return buildRoute(route.points, {
    profile: route.profile ?? defaultRoute.profile,
    branchAltitudeById: route.branchAltitudeById ?? {},
    branchWindById: route.branchWindById ?? {}
  });
}

export function useActiveRoute() {
  const [route, setRoute] = useLocalStorageState<NavRoute>(STORAGE_KEY, defaultRoute);
  const [selectedPointId, setSelectedPointId] = useState(route.points[1]?.id ?? route.points[0]?.id ?? null);
  const [routeMessage, setRouteMessage] = useState('Route prête');
  const [weatherStatus, setWeatherStatus] = useState('Vent non chargé');

  const normalizedRoute = useMemo(() => safeRoute(route), [route]);
  const selectedPoint = useMemo(() => normalizedRoute.points.find((point) => point.id === selectedPointId) ?? null, [normalizedRoute.points, selectedPointId]);

  const rebuild = (
    points: NavPoint[] = normalizedRoute.points,
    profile: Partial<FlightProfile> = normalizedRoute.profile,
    branchAltitudeById = normalizedRoute.branchAltitudeById,
    branchWindById: Record<string, BranchWind> = normalizedRoute.branchWindById,
    message = 'Route mise à jour'
  ) => {
    const nextRoute = buildRoute(relabelRoutePoints(points), { profile, branchAltitudeById, branchWindById });
    setRoute(nextRoute);
    setRouteMessage(message);
    return nextRoute;
  };

  const setDepartureCode = (code: string): boolean => {
    const point = createAerodromePoint(code, 'depart');
    if (!point) {
      setRouteMessage(`Code départ inconnu : ${code.trim().toUpperCase()}`);
      return false;
    }
    const nextPoints = [point, ...normalizedRoute.points.slice(1)];
    rebuild(nextPoints, normalizedRoute.profile, normalizedRoute.branchAltitudeById, {}, `Départ ${point.code}`);
    setWeatherStatus('Vent à rafraîchir');
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
    rebuild(nextPoints, normalizedRoute.profile, normalizedRoute.branchAltitudeById, {}, `Arrivée ${point.code}`);
    setWeatherStatus('Vent à rafraîchir');
    setSelectedPointId(point.id);
    return true;
  };

  const addWaypointAt = (longitude: number, latitude: number) => {
    const insertIndex = Math.max(1, normalizedRoute.points.length - 1);
    const nextWaypointNumber = normalizedRoute.points.filter((point) => point.type === 'waypoint' && point.source !== 'aerodrome').length + 1;
    const point = createManualWaypoint(latitude, longitude, nextWaypointNumber);
    const points = [...normalizedRoute.points];
    points.splice(insertIndex, 0, point);
    rebuild(points, normalizedRoute.profile, normalizedRoute.branchAltitudeById, {}, `${point.code} ajouté`);
    setWeatherStatus('Vent à rafraîchir');
    setSelectedPointId(point.id);
  };

  const removePoint = (pointId: string) => {
    const point = normalizedRoute.points.find((item) => item.id === pointId);
    if (!point || point.type !== 'waypoint') return;
    const points = normalizedRoute.points.filter((item) => item.id !== pointId);
    rebuild(points, normalizedRoute.profile, normalizedRoute.branchAltitudeById, {}, `${point.code ?? point.nom} supprimé`);
    setWeatherStatus('Vent à rafraîchir');
    setSelectedPointId(points[1]?.id ?? points[0]?.id ?? null);
  };

  const reverseRoute = () => {
    const points = normalizedRoute.points.slice().reverse().map((point, index, array) => ({
      ...point,
      type: index === 0 ? 'depart' as const : index === array.length - 1 ? 'destination' as const : 'waypoint' as const,
      id: `${index === 0 ? 'depart' : index === array.length - 1 ? 'destination' : 'waypoint'}-${point.code?.toLowerCase() ?? point.id}`
    }));
    rebuild(points, normalizedRoute.profile, {}, {}, 'Route inversée');
    setWeatherStatus('Vent à rafraîchir');
    setSelectedPointId(points[1]?.id ?? points[0]?.id ?? null);
  };

  const setTasKt = (tasKt: number) => {
    const profile = { ...normalizedRoute.profile, tasKt };
    rebuild(normalizedRoute.points, profile, normalizedRoute.branchAltitudeById, normalizedRoute.branchWindById, `TAS ${Math.round(tasKt)} kt`);
  };

  const setDefaultAltitudeFt = (defaultAltitudeFt: number) => {
    const profile = { ...normalizedRoute.profile, defaultAltitudeFt };
    rebuild(normalizedRoute.points, profile, {}, {}, `Altitude défaut ${Math.round(defaultAltitudeFt)} ft`);
    setWeatherStatus('Vent à rafraîchir');
  };

  const setDepartureTimeIso = (departureTimeIso: string) => {
    const profile = { ...normalizedRoute.profile, departureTimeIso };
    rebuild(normalizedRoute.points, profile, normalizedRoute.branchAltitudeById, {}, 'Heure de départ mise à jour');
    setWeatherStatus('Vent à rafraîchir');
  };

  const setBranchAltitudeFt = (branchId: string, altitudeFt: number) => {
    const nextAltitudes = { ...normalizedRoute.branchAltitudeById, [branchId]: altitudeFt };
    const nextWinds = { ...normalizedRoute.branchWindById };
    delete nextWinds[branchId];
    rebuild(normalizedRoute.points, normalizedRoute.profile, nextAltitudes, nextWinds, 'Altitude branche mise à jour');
    setWeatherStatus('Vent à rafraîchir');
  };

  const refreshWinds = async () => {
    setWeatherStatus('Vent en cours...');
    try {
      const winds = await fetchWindAloftForRoute(normalizedRoute);
      const next = rebuild(normalizedRoute.points, normalizedRoute.profile, normalizedRoute.branchAltitudeById, {
        ...normalizedRoute.branchWindById,
        ...winds
      }, 'Vent mis à jour');
      const loaded = Object.keys(winds).length;
      setWeatherStatus(loaded ? `Vent OK ${loaded}/${next.branches.length}` : 'Vent non reçu');
    } catch {
      setWeatherStatus('Erreur météo');
    }
  };

  const resetRoute = () => {
    setRoute(defaultRoute);
    setSelectedPointId(defaultRoute.points[1]?.id ?? defaultRoute.points[0].id);
    setRouteMessage('Route exemple restaurée');
    setWeatherStatus('Vent non chargé');
  };

  return {
    route: normalizedRoute,
    selectedPoint,
    selectedPointId,
    routeMessage,
    weatherStatus,
    setSelectedPointId,
    setDepartureCode,
    setDestinationCode,
    addWaypointAt,
    removePoint,
    reverseRoute,
    setTasKt,
    setDefaultAltitudeFt,
    setDepartureTimeIso,
    setBranchAltitudeFt,
    refreshWinds,
    resetRoute
  };
}
