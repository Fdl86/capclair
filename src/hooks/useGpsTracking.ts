import { useEffect, useMemo, useRef, useState } from 'react';
import type { GpsPosition, GpsStatus } from '../domain/gps.types';
import type { NavRoute } from '../domain/navigation.types';
import type { Trace } from '../domain/trace.types';
import { distanceNm, totalDistanceNm } from '../services/geo/distance';
import { toGpsPosition, isPlausibleGpsPosition, isUsableGpsPosition } from '../services/gps/geolocationService';
import { interpolateSimulationPoint, simulationTotalSteps } from '../services/gps/simulationService';
import { getCrossTrackError, getProgressiveCrossTrackError, type CrossTrackResult } from '../services/geo/crossTrackError';

const TRACE_SAMPLE_INTERVAL_MS = 3000;
const TRACE_MAX_POINTS = 4200;

export function useGpsTracking(route: NavRoute, onTraceReady: (trace: Trace) => void) {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [positions, setPositions] = useState<GpsPosition[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GpsPosition | null>(null);
  const [crossTrack, setCrossTrack] = useState<CrossTrackResult>(() => getCrossTrackError(null, route.points));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<number | null>(null);
  const simStep = useRef(0);
  const startTime = useRef<number | null>(null);
  const statusRef = useRef<GpsStatus>('idle');
  const lastSignalAt = useRef<number | null>(null);
  const lastLivePosition = useRef<GpsPosition | null>(null);
  const lastTraceSampleAt = useRef<number | null>(null);
  const activeSegmentIndex = useRef<number | null>(null);

  const updateStatus = (next: GpsStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

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

  const resetTrackingData = () => {
    setPositions([]);
    setCurrentPosition(null);
    setLastAccuracy(null);
    lastSignalAt.current = null;
    lastLivePosition.current = null;
    lastTraceSampleAt.current = null;
    activeSegmentIndex.current = null;
    setCrossTrack(getCrossTrackError(null, route.points));
  };

  const appendTraceSample = (position: GpsPosition, force = false) => {
    const previousSampleAt = lastTraceSampleAt.current;
    const shouldSample = force || previousSampleAt === null || position.timestamp - previousSampleAt >= TRACE_SAMPLE_INTERVAL_MS;
    if (!shouldSample) return;

    lastTraceSampleAt.current = position.timestamp;
    setPositions((current) => [...current, position].slice(-TRACE_MAX_POINTS));
  };

  const ingestPosition = (position: GpsPosition, forceTraceSample = false) => {
    setLastAccuracy(position.precision);
    lastSignalAt.current = Date.now();

    if (!isPlausibleGpsPosition(position)) return;

    lastLivePosition.current = position;
    setCurrentPosition(position);

    const nextCrossTrack = getProgressiveCrossTrackError(position, route.points, activeSegmentIndex.current);
    activeSegmentIndex.current = nextCrossTrack.segmentIndex;
    setCrossTrack(nextCrossTrack);

    const previousTraceSample = positions.at(-1) ?? null;
    if (forceTraceSample || isUsableGpsPosition(position, previousTraceSample)) {
      appendTraceSample(position, forceTraceSample);
    }
  };

  const handleNativePosition = (nativePosition: GeolocationPosition) => {
    updateStatus('active');
    setErrorMessage(null);
    ingestPosition(toGpsPosition(nativePosition));
  };

  const startGps = () => {
    clearGpsWatch();
    clearSimulation();
    setErrorMessage(null);
    resetTrackingData();
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
    resetTrackingData();
    startTime.current = Date.now();
    simStep.current = 0;

    const totalSteps = simulationTotalSteps(route.points);
    ingestPosition(interpolateSimulationPoint(route.points, simStep.current), true);

    simTimer.current = window.setInterval(() => {
      simStep.current += 1;
      const finalStep = simStep.current >= totalSteps;
      ingestPosition(interpolateSimulationPoint(route.points, simStep.current), finalStep);

      if (finalStep) {
        clearSimulation();
        updateStatus('simulation-complete');
        setErrorMessage('Simulation terminée. Vous pouvez sauvegarder la trace.');
      }
    }, 1000);
  };

  const stopAndSave = () => {
    clearGpsWatch();
    clearSimulation();
    const finalPositions = currentPosition && positions.at(-1)?.timestamp !== currentPosition.timestamp
      ? [...positions, currentPosition].slice(-TRACE_MAX_POINTS)
      : positions;
    const duration = startTime.current ? Math.round((Date.now() - startTime.current) / 1000) : 0;
    const trace: Trace = {
      id: `trace-${Date.now()}`,
      routeId: route.id,
      routeName: route.nom,
      date: new Date().toISOString(),
      positions: finalPositions,
      dureeSec: duration,
      distanceNm: Number(totalDistanceNm(finalPositions).toFixed(2))
    };
    onTraceReady(trace);
    setPositions(finalPositions);
    updateStatus('stopped');
  };

  useEffect(() => {
    activeSegmentIndex.current = null;
    setCrossTrack(getCrossTrackError(currentPosition, route.points));
  }, [route.points]);

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
    traceSampleIntervalMs: TRACE_SAMPLE_INTERVAL_MS,
    traceMaxPoints: TRACE_MAX_POINTS,
    startGps,
    startSimulation,
    stopAndSave
  };
}
