import { useEffect, useMemo, useRef, useState } from 'react';
import type { GpsPosition, GpsStatus } from '../domain/gps.types';
import type { NavRoute } from '../domain/navigation.types';
import type { Trace } from '../domain/trace.types';
import { distanceNm, totalDistanceNm } from '../services/geo/distance';
import { toGpsPosition, isUsableGpsPosition } from '../services/gps/geolocationService';
import { interpolateSimulationPoint } from '../services/gps/simulationService';
import { getCrossTrackError } from '../services/geo/crossTrackError';

export function useGpsTracking(route: NavRoute, onTraceReady: (trace: Trace) => void) {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [positions, setPositions] = useState<GpsPosition[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<number | null>(null);
  const simStep = useRef(0);
  const startTime = useRef<number | null>(null);
  const statusRef = useRef<GpsStatus>('idle');
  const lastSignalAt = useRef<number | null>(null);

  const updateStatus = (next: GpsStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const currentPosition = positions.at(-1) ?? null;
  const crossTrack = useMemo(() => getCrossTrackError(currentPosition, route.points), [currentPosition, route.points]);
  const distanceTravelledNm = useMemo(() => totalDistanceNm(positions), [positions]);

  const clearGpsWatch = () => {
    if (watchId.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  const clearSimulation = () => {
    if (simTimer.current !== null) {
      window.clearInterval(simTimer.current);
      simTimer.current = null;
    }
  };

  const appendPosition = (position: GpsPosition) => {
    setLastAccuracy(position.precision);
    lastSignalAt.current = Date.now();
    setPositions((current) => {
      const previous = current.at(-1) ?? null;
      if (!isUsableGpsPosition(position, previous)) return current;
      return [...current, position].slice(-1600);
    });
  };

  const handleNativePosition = (nativePosition: GeolocationPosition) => {
    updateStatus('active');
    setErrorMessage(null);
    appendPosition(toGpsPosition(nativePosition));
  };

  const startGps = () => {
    clearGpsWatch();
    clearSimulation();
    setErrorMessage(null);
    setPositions([]);
    setLastAccuracy(null);
    lastSignalAt.current = null;
    startTime.current = Date.now();

    if (!('geolocation' in navigator)) {
      updateStatus('unavailable');
      setErrorMessage('GPS indisponible sur cet appareil. Mode simulation disponible.');
      return;
    }

    updateStatus('requesting');

    watchId.current = navigator.geolocation.watchPosition(
      handleNativePosition,
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        if (denied) {
          clearGpsWatch();
          updateStatus('denied');
          setErrorMessage('Permission GPS refusée. Mode simulation disponible.');
          return;
        }

        setErrorMessage(
          statusRef.current === 'active'
            ? 'Signal GPS momentanément faible. Le suivi continue dès la prochaine position.'
            : 'Recherche GPS en cours. Placez le téléphone près d’une fenêtre ou en extérieur si le signal tarde.'
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );
  };

  const startSimulation = () => {
    clearGpsWatch();
    clearSimulation();
    updateStatus('simulating');
    setErrorMessage(null);
    setPositions([]);
    setLastAccuracy(18);
    lastSignalAt.current = Date.now();
    simStep.current = 0;
    startTime.current = Date.now();
    appendPosition(interpolateSimulationPoint(route.points, simStep.current));
    simTimer.current = window.setInterval(() => {
      simStep.current += 1;
      appendPosition(interpolateSimulationPoint(route.points, simStep.current));
    }, 1000);
  };

  const stopAndSave = () => {
    clearGpsWatch();
    clearSimulation();
    const duration = startTime.current ? Math.round((Date.now() - startTime.current) / 1000) : 0;
    const trace: Trace = {
      id: `trace-${Date.now()}`,
      routeId: route.id,
      routeName: route.nom,
      date: new Date().toISOString(),
      positions,
      dureeSec: duration,
      distanceNm: Number(distanceTravelledNm.toFixed(2))
    };
    onTraceReady(trace);
    updateStatus('stopped');
  };

  useEffect(() => {
    return () => {
      clearGpsWatch();
      clearSimulation();
    };
  }, []);

  const nextPoint = route.points[crossTrack.segmentIndex + 1] ?? route.points.at(-1) ?? null;
  const nextPointDistance = currentPosition && nextPoint ? distanceNm(currentPosition, nextPoint) : null;

  return {
    status,
    positions,
    currentPosition,
    crossTrack,
    distanceTravelledNm,
    nextPoint,
    nextPointDistance,
    errorMessage,
    lastAccuracy,
    lastSignalAt: lastSignalAt.current,
    startGps,
    startSimulation,
    stopAndSave
  };
}
