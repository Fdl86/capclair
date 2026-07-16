import { useMemo, useRef, useState } from 'react';
import type { BranchWind, FlightProfile, NavPoint, NavRoute } from '../domain/navigation.types';
import { useLocalStorageState } from './useLocalStorageState';
import { buildRoute, createAerodromePoint, createDefaultRoute, createManualWaypoint, relabelRoutePoints, replaceRouteEndpoint } from '../services/navigation/routeBuilder';
import { fetchWindAloftForRoute } from '../services/weather/windAloftClient';
import { isRouteReady, routeMissingMessage } from '../services/navigation/routeValidation';

const STORAGE_KEY = 'capclair.activeRoute.dev13_4.weatherAudit';
const defaultRoute = createDefaultRoute();

function pointCode(route: NavRoute, id: string): string {
  const point = route.points.find((item) => item.id === id);
  return point?.code ?? point?.nom ?? id.toUpperCase();
}

function branchLabel(route: NavRoute, branchId: string): string {
  const branch = route.branches.find((item) => item.id === branchId);
  if (!branch) return branchId;
  return `${pointCode(route, branch.from)}-${pointCode(route, branch.to)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function routeWeatherSignature(route: NavRoute): string {
  return [
    route.id,
    route.profile.departureTimeIso,
    route.profile.tasKt,
    route.points.map((point) => `${point.id}:${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`).join('>'),
    route.branches.map((branch) => `${branch.id}:${branch.altitudeFt}`).join('|')
  ].join('::');
}

function segmentDistanceNm(point: Pick<NavPoint, 'latitude' | 'longitude'>, start: NavPoint, end: NavPoint): number {
  const averageLatRad = ((start.latitude + end.latitude + point.latitude) / 3) * Math.PI / 180;
  const x2 = (end.longitude - start.longitude) * Math.cos(averageLatRad) * 60;
  const y2 = (end.latitude - start.latitude) * 60;
  const xp = (point.longitude - start.longitude) * Math.cos(averageLatRad) * 60;
  const yp = (point.latitude - start.latitude) * 60;
  const segmentLengthSquared = x2 * x2 + y2 * y2;

  if (segmentLengthSquared <= 0.000001) return Math.hypot(xp, yp);

  const projection = clamp((xp * x2 + yp * y2) / segmentLengthSquared, 0, 1);
  return Math.hypot(xp - projection * x2, yp - projection * y2);
}

function nearestRouteSegmentIndex(points: NavPoint[], longitude: number, latitude: number): number {
  if (points.length < 2) return 0;

  const clickedPoint = { longitude, latitude };
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length - 1; index += 1) {
    const distance = segmentDistanceNm(clickedPoint, points[index], points[index + 1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function safeRoute(route: NavRoute): NavRoute {
  if (!route || !Array.isArray(route.points)) return defaultRoute;
  return buildRoute(route.points, {
    profile: route.profile ?? defaultRoute.profile,
    branchAltitudeById: route.branchAltitudeById ?? {},
    branchWindById: route.branchWindById ?? {},
    routeId: route.id || defaultRoute.id,
    weatherAnalysisTimeIso: route.weatherAnalysisTimeIso ?? null
  });
}

export function useActiveRoute() {
  const [route, setRoute] = useLocalStorageState<NavRoute>(STORAGE_KEY, defaultRoute);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(route.points[1]?.id ?? route.points[0]?.id ?? null);
  const [routeMessage, setRouteMessage] = useState('Route prête');
  const [weatherStatus, setWeatherStatus] = useState('Vent non chargé');
  const [weatherUpdating, setWeatherUpdating] = useState(false);
  const weatherRequestIdRef = useRef(0);
  const latestRouteRef = useRef<NavRoute>(route);

  const normalizedRoute = useMemo(() => safeRoute(route), [route]);
  latestRouteRef.current = normalizedRoute;
  const selectedPoint = useMemo(
    () => normalizedRoute.points.find((point) => point.id === selectedPointId) ?? null,
    [normalizedRoute.points, selectedPointId]
  );

  const rebuild = (
    points: NavPoint[] = normalizedRoute.points,
    profile: Partial<FlightProfile> = normalizedRoute.profile,
    branchAltitudeById = normalizedRoute.branchAltitudeById,
    branchWindById: Record<string, BranchWind> = normalizedRoute.branchWindById,
    message = 'Route mise à jour',
    weatherAnalysisTimeIso: string | null = Object.keys(branchWindById).length ? normalizedRoute.weatherAnalysisTimeIso ?? null : null,
    routeId = normalizedRoute.id
  ) => {
    const nextRoute = buildRoute(relabelRoutePoints(points), {
      profile,
      branchAltitudeById,
      branchWindById,
      routeId,
      weatherAnalysisTimeIso
    });
    setRoute(nextRoute);
    latestRouteRef.current = nextRoute;
    setRouteMessage(message);
    return nextRoute;
  };

  const invalidateWeather = () => {
    weatherRequestIdRef.current += 1;
    setWeatherUpdating(false);
  };

  const setDepartureCode = (code: string): boolean => {
    const normalized = code.trim().toUpperCase();
    invalidateWeather();
    if (!normalized) {
      const nextPoints = replaceRouteEndpoint(normalizedRoute.points, null, 'depart');
      rebuild(nextPoints, normalizedRoute.profile, {}, {}, 'Départ effacé', null);
      setWeatherStatus('Vent non chargé');
      setSelectedPointId(nextPoints[0]?.id ?? null);
      return true;
    }

    const point = createAerodromePoint(normalized, 'depart');
    if (!point) {
      setRouteMessage(`Code départ inconnu : ${normalized}`);
      return false;
    }

    const nextPoints = replaceRouteEndpoint(normalizedRoute.points, point, 'depart');
    rebuild(nextPoints, normalizedRoute.profile, normalizedRoute.branchAltitudeById, {}, `Départ ${point.code}`, null);
    setWeatherStatus('Vent à rafraîchir');
    setSelectedPointId(point.id);
    return true;
  };

  const setDestinationCode = (code: string): boolean => {
    const normalized = code.trim().toUpperCase();
    invalidateWeather();
    if (!normalized) {
      const nextPoints = replaceRouteEndpoint(normalizedRoute.points, null, 'destination');
      rebuild(nextPoints, normalizedRoute.profile, {}, {}, 'Arrivée effacée', null);
      setWeatherStatus('Vent non chargé');
      setSelectedPointId(nextPoints.at(-1)?.id ?? null);
      return true;
    }

    const point = createAerodromePoint(normalized, 'destination');
    if (!point) {
      setRouteMessage(`Code arrivée inconnu : ${normalized}`);
      return false;
    }

    const nextPoints = replaceRouteEndpoint(normalizedRoute.points, point, 'destination');
    rebuild(nextPoints, normalizedRoute.profile, normalizedRoute.branchAltitudeById, {}, `Arrivée ${point.code}`, null);
    setWeatherStatus('Vent à rafraîchir');
    setSelectedPointId(point.id);
    return true;
  };

  const applyBriefingRoute = (departureCode: string, destinationCode: string, departureTimeIso?: string | null): boolean => {
    const departure = createAerodromePoint(departureCode.trim().toUpperCase(), 'depart');
    const destination = createAerodromePoint(destinationCode.trim().toUpperCase(), 'destination');
    if (!departure || !destination) {
      setRouteMessage('Le trajet détecté contient un aérodrome inconnu dans CAP CLAIR.');
      return false;
    }
    invalidateWeather();
    const profile = {
      ...normalizedRoute.profile,
      ...(departureTimeIso ? { departureTimeIso } : {})
    };
    const nextRoute = rebuild([departure, destination], profile, {}, {}, `Trajet ${departure.code} > ${destination.code} importé depuis le PIB`, null);
    setWeatherStatus('Vent à rafraîchir');
    setSelectedPointId(nextRoute.points[0]?.id ?? null);
    return true;
  };

  const addWaypointAt = (longitude: number, latitude: number) => {
    if (!isRouteReady(normalizedRoute)) {
      setRouteMessage('Définir un départ et une arrivée avant d’ajouter un point');
      return;
    }

    invalidateWeather();
    const insertIndex = nearestRouteSegmentIndex(normalizedRoute.points, longitude, latitude) + 1;
    const nextWaypointNumber = normalizedRoute.points.filter((point) => point.type === 'waypoint' && point.source !== 'aerodrome').length + 1;
    const point = createManualWaypoint(latitude, longitude, nextWaypointNumber);
    const points = [...normalizedRoute.points];
    points.splice(insertIndex, 0, point);
    rebuild(points, normalizedRoute.profile, normalizedRoute.branchAltitudeById, {}, `${point.code} ajouté`, null);
    setWeatherStatus('Vent à rafraîchir');
    setSelectedPointId(point.id);
  };

  const removePoint = (pointId: string) => {
    const point = normalizedRoute.points.find((item) => item.id === pointId);
    if (!point || point.type !== 'waypoint') return;
    invalidateWeather();
    const points = normalizedRoute.points.filter((item) => item.id !== pointId);
    rebuild(points, normalizedRoute.profile, normalizedRoute.branchAltitudeById, {}, `${point.code ?? point.nom} supprimé`, null);
    setWeatherStatus('Vent à rafraîchir');
    setSelectedPointId(points[1]?.id ?? points[0]?.id ?? null);
  };

  const reverseRoute = () => {
    if (!isRouteReady(normalizedRoute)) {
      setRouteMessage('Définir un départ et une arrivée avant d’inverser la route');
      return;
    }

    invalidateWeather();
    const reversed = normalizedRoute.points.slice().reverse();
    const points = reversed.map((point, index, array) => ({
      ...point,
      type: index === 0 ? 'depart' as const : index === array.length - 1 ? 'destination' as const : 'waypoint' as const,
      id: `${index === 0 ? 'depart' : index === array.length - 1 ? 'destination' : 'waypoint'}-${point.code?.toLowerCase() ?? point.id}`
    }));
    rebuild(points, normalizedRoute.profile, {}, {}, 'Route inversée', null);
    setWeatherStatus('Vent à rafraîchir');
    setSelectedPointId(points[1]?.id ?? points[0]?.id ?? null);
  };

  const setTasKt = (tasKt: number) => {
    rebuild(
      normalizedRoute.points,
      { ...normalizedRoute.profile, tasKt },
      normalizedRoute.branchAltitudeById,
      normalizedRoute.branchWindById,
      `TAS ${Math.round(tasKt)} kt`
    );
  };

  const setDefaultAltitudeFt = (defaultAltitudeFt: number) => {
    invalidateWeather();
    rebuild(
      normalizedRoute.points,
      { ...normalizedRoute.profile, defaultAltitudeFt },
      normalizedRoute.branchAltitudeById,
      {},
      `Altitude défaut ${Math.round(defaultAltitudeFt)} ft`,
      null
    );
    setWeatherStatus('Vent à rafraîchir');
  };

  const setDepartureTimeIso = (departureTimeIso: string) => {
    invalidateWeather();
    rebuild(
      normalizedRoute.points,
      { ...normalizedRoute.profile, departureTimeIso },
      normalizedRoute.branchAltitudeById,
      {},
      'Heure de départ mise à jour',
      null
    );
    setWeatherStatus('Vent à rafraîchir');
  };

  const setBranchAltitudeFt = (branchId: string, altitudeFt: number) => {
    invalidateWeather();
    const nextAltitudes = { ...normalizedRoute.branchAltitudeById, [branchId]: altitudeFt };
    const nextWinds = { ...normalizedRoute.branchWindById };
    delete nextWinds[branchId];
    rebuild(normalizedRoute.points, normalizedRoute.profile, nextAltitudes, nextWinds, 'Altitude branche mise à jour');
    setWeatherStatus('Vent à rafraîchir');
  };

  const refreshWinds = async () => {
    if (weatherUpdating) return;
    if (!isRouteReady(normalizedRoute)) {
      setWeatherStatus('Départ et arrivée requis');
      setRouteMessage(routeMissingMessage(normalizedRoute));
      return;
    }

    const requestId = weatherRequestIdRef.current + 1;
    weatherRequestIdRef.current = requestId;
    const routeAtRequest = normalizedRoute;
    const signatureAtRequest = routeWeatherSignature(routeAtRequest);
    const analysisTimeIso = new Date().toISOString();
    setWeatherUpdating(true);
    setWeatherStatus('Météo-France en cours...');

    try {
      const winds = await fetchWindAloftForRoute(routeAtRequest, analysisTimeIso);
      const currentRoute = latestRouteRef.current;
      if (weatherRequestIdRef.current !== requestId || routeWeatherSignature(currentRoute) !== signatureAtRequest) {
        if (weatherRequestIdRef.current === requestId) setWeatherStatus('Route modifiée - relancez Maj vent');
        return;
      }

      const next = rebuild(routeAtRequest.points, routeAtRequest.profile, routeAtRequest.branchAltitudeById, {
        ...routeAtRequest.branchWindById,
        ...winds
      }, 'Vent mis à jour', analysisTimeIso, routeAtRequest.id);
      const loaded = Object.keys(winds).length;
      const missingBranches = next.branches.filter((branch) => !winds[branch.id]).map((branch) => branchLabel(next, branch.id));
      setWeatherStatus(
        loaded === next.branches.length
          ? `Vent OK ${loaded}/${next.branches.length}`
          : loaded > 0
            ? `Vent partiel ${loaded}/${next.branches.length} - manque ${missingBranches.slice(0, 2).join(', ')}`
            : 'Météo-France non reçu'
      );
    } catch {
      if (weatherRequestIdRef.current === requestId) setWeatherStatus('Erreur Météo-France');
    } finally {
      if (weatherRequestIdRef.current === requestId) setWeatherUpdating(false);
    }
  };

  const resetRoute = (tasKt = normalizedRoute.profile.tasKt) => {
    invalidateWeather();
    const nextRoute = createDefaultRoute({
      tasKt,
      defaultAltitudeFt: normalizedRoute.profile.defaultAltitudeFt
    });
    setRoute(nextRoute);
    latestRouteRef.current = nextRoute;
    setSelectedPointId(null);
    setRouteMessage('Nouvelle navigation prête');
    setWeatherStatus('Vent non chargé');
  };

  return {
    route: normalizedRoute,
    selectedPoint,
    selectedPointId,
    routeMessage,
    weatherStatus,
    weatherUpdating,
    setSelectedPointId,
    setDepartureCode,
    setDestinationCode,
    applyBriefingRoute,
    addWaypointAt,
    removePoint,
    reverseRoute,
    setTasKt,
    setDefaultAltitudeFt,
    setDepartureTimeIso,
    setBranchAltitudeFt,
    refreshWinds,
    resetRoute,
    setRouteMessage
  };
}
