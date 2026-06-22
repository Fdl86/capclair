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
  const [lastSignalAt, setLastSignalAt] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<number | null>(null);
  const simStep = useRef(0);
  const startTime = useRef<number | null>(null);

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
    setLastSignalAt(Date.now());
    setPositions((current) => {
      const previous = current.at(-1) ?? null;
      if (!isUsableGpsPosition(position, previous)) return current;
      return [...current, position].slice(-1600);
    });
  };

  const handleNativePosition = (nativePosition: GeolocationPosition) => {
    setStatus('active');
    setErrorMessage(null);
    appendPosition(toGpsPosition(nativePosition));
  };

  const startGps = () => {
    clearGpsWatch();
    clearSimulation();
    setErrorMessage(null);
    setPositions([]);
    setLastAccuracy(null);
    setLastSignalAt(null);
    startTime.current = Date.now();

    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      setErrorMessage('GPS indisponible sur cet appareil. Mode simulation disponible.');
      return;
    }

    setStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      handleNativePosition,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          clearGpsWatch();
          setStatus('denied');
          setErrorMessage('Permission GPS refusée. Mode simulation disponible.');
          return;
        }
        setErrorMessage('Recherche GPS en cours. Placez le téléphone près d’une fenêtre ou en extérieur si le signal tarde.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000
      }
    );

    watchId.current = navigator.geolocation.watchPosition(
      handleNativePosition,
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        if (denied) {
          clearGpsWatch();
          setStatus('denied');
          setErrorMessage('Permission GPS refusée. Mode simulation disponible.');
          return;
        }

        setErrorMessage(
          status === 'active'
            ? 'Signal GPS momentanément faible. Le suivi continue dès la prochaine position.'
            : 'Recherche GPS en cours. Signal lent ou imprécis.'
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000
      }
    );
  };

  const startSimulation = () => {
    clearGpsWatch();
    clearSimulation();
    setStatus('simulating');
    setErrorMessage(null);
    setPositions([]);
    setLastAccuracy(18);
    setLastSignalAt(Date.now());
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
    setStatus('stopped');
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
    lastSignalAt,
    startGps,
    startSimulation,
    stopAndSave
  };
}
