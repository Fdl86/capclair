import { useEffect, useRef, useState } from 'react';
import type { GpsPosition, GpsStatus, GpsTraceDiagnostics } from '../domain/gps.types';
import type { NavRoute } from '../domain/navigation.types';
import type { Trace, TraceSource } from '../domain/trace.types';
import type { TraceSaveResult } from '../services/storage/traceStorage';
import { distanceNm } from '../services/geo/distance';
import {
  toGpsPosition,
  isPlausibleGpsPosition,
  isReliableGpsAltitude,
  classifyGpsPosition
} from '../services/gps/geolocationService';
import { interpolateSimulationPoint, simulationTotalSteps } from '../services/gps/simulationService';
import { getCrossTrackError, getProgressiveCrossTrackError, type CrossTrackResult } from '../services/geo/crossTrackError';
import { isRouteReady } from '../services/navigation/routeValidation';
import { createPlannedRouteSnapshot } from '../services/traces/plannedRouteSnapshot';
import {
  TRACE_GAP_BREAK_MS,
  compactSegmentedTrace,
  computeTraceMetrics
} from '../services/traces/traceSegments';

const TRACE_SAMPLE_INTERVAL_MS = 3000;
const TRACE_MAX_POINTS = 7200;
const GPS_DEGRADED_AFTER_MS = 10000;
const GPS_FROZEN_AFTER_MS = 30000;
const MAX_CONSECUTIVE_TRACE_REJECTIONS = 5;
const STATIONARY_SPEED_KT_THRESHOLD = 5;
const STATIONARY_DRIFT_RADIUS_M = 60;

const emptyDiagnostics = (): GpsTraceDiagnostics => ({
  rawReceived: 0,
  rejectedPrecision: 0,
  rejectedRedundant: 0,
  rejectedSpeed: 0,
  rejectedDrift: 0,
  forcedResync: 0,
  tracePoints: 0,
  gpsGaps: 0,
  gpsResumptions: 0,
  missingAltitude: 0,
  unreliableAltitude: 0,
  maxObservedSpeedKt: 0
});

function impliedSpeedKt(previous: GpsPosition | null, current: GpsPosition): number | null {
  if (!previous) return null;
  const elapsedHours = (current.timestamp - previous.timestamp) / 3_600_000;
  if (elapsedHours <= 0) return null;
  return distanceNm(previous, current) / elapsedHours;
}

function samePosition(a: GpsPosition | null, b: GpsPosition | null): boolean {
  return Boolean(a && b
    && a.timestamp === b.timestamp
    && a.latitude === b.latitude
    && a.longitude === b.longitude);
}

function sessionNeedsConfirmation(status: GpsStatus): boolean {
  return ['requesting', 'active', 'degraded', 'frozen', 'simulating', 'simulation-complete', 'saving', 'save-error'].includes(status);
}

export function useGpsTracking(route: NavRoute, onTraceReady: (trace: Trace) => Promise<TraceSaveResult>) {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [positions, setPositions] = useState<GpsPosition[]>([]);
  const [segmentStartIndices, setSegmentStartIndices] = useState<number[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GpsPosition | null>(null);
  const [crossTrack, setCrossTrack] = useState<CrossTrackResult>(() => getCrossTrackError(null, route.points));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const [lastAltitudeAccuracy, setLastAltitudeAccuracy] = useState<number | null>(null);
  const [lastSignalAgeSec, setLastSignalAgeSec] = useState<number | null>(null);
  const [distanceTravelledNm, setDistanceTravelledNm] = useState(0);
  const [diagnostics, setDiagnostics] = useState<GpsTraceDiagnostics>(emptyDiagnostics);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<number | null>(null);
  const simStep = useRef(0);
  const startTime = useRef<number | null>(null);
  const sessionSourceRef = useRef<TraceSource>('web');
  const statusRef = useRef<GpsStatus>('idle');
  const hasUnsavedTraceRef = useRef(false);
  const lastSignalAt = useRef<number | null>(null);
  const gapOpen = useRef(false);
  const lastLivePosition = useRef<GpsPosition | null>(null);
  const lastValidatedTracePosition = useRef<GpsPosition | null>(null);
  const lastTraceSampleAt = useRef<number | null>(null);
  const activeSegmentIndex = useRef<number | null>(null);
  const traceRejectionStreak = useRef(0);
  const groundAnchor = useRef<GpsPosition | null>(null);
  const lastTraceSample = useRef<GpsPosition | null>(null);
  const positionsRef = useRef<GpsPosition[]>([]);
  const segmentStartIndicesRef = useRef<number[]>([]);
  const distanceTravelledRef = useRef(0);
  const diagnosticsRef = useRef<GpsTraceDiagnostics>(emptyDiagnostics());

  const commitDiagnostics = (next: GpsTraceDiagnostics) => {
    diagnosticsRef.current = next;
    setDiagnostics(next);
  };

  const bumpDiagnostics = (key: keyof GpsTraceDiagnostics) => {
    const current = diagnosticsRef.current[key];
    const numericCurrent = typeof current === 'number' ? current : 0;
    commitDiagnostics({ ...diagnosticsRef.current, [key]: numericCurrent + 1 });
  };

  const updateObservedSpeed = (position: GpsPosition, previous: GpsPosition | null) => {
    const observed = Math.max(position.vitesse ?? 0, impliedSpeedKt(previous, position) ?? 0);
    if (observed > diagnosticsRef.current.maxObservedSpeedKt) {
      commitDiagnostics({ ...diagnosticsRef.current, maxObservedSpeedKt: Number(observed.toFixed(1)) });
    }
  };

  const updateStatus = (next: GpsStatus) => {
    if (statusRef.current === next) return;
    statusRef.current = next;
    hasUnsavedTraceRef.current = sessionNeedsConfirmation(next);
    setStatus(next);
  };

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
    positionsRef.current = [];
    segmentStartIndicesRef.current = [];
    setPositions([]);
    setSegmentStartIndices([]);
    setCurrentPosition(null);
    setLastAccuracy(null);
    setLastAltitudeAccuracy(null);
    setLastSignalAgeSec(null);
    setDistanceTravelledNm(0);
    setRecordingElapsedSec(0);
    lastSignalAt.current = null;
    gapOpen.current = false;
    lastLivePosition.current = null;
    lastValidatedTracePosition.current = null;
    lastTraceSampleAt.current = null;
    activeSegmentIndex.current = null;
    traceRejectionStreak.current = 0;
    groundAnchor.current = null;
    lastTraceSample.current = null;
    distanceTravelledRef.current = 0;
    commitDiagnostics(emptyDiagnostics());
    setCrossTrack(getCrossTrackError(null, route.points));
  };

  const appendTraceSample = (position: GpsPosition, force = false, forceNewSegment = false): boolean => {
    if (samePosition(lastTraceSample.current, position)) return false;
    const previousSampleAt = lastTraceSampleAt.current;
    const shouldSample = force || previousSampleAt === null || position.timestamp - previousSampleAt >= TRACE_SAMPLE_INTERVAL_MS;
    if (!shouldSample) return false;

    const previous = lastTraceSample.current;
    const delta = previous ? position.timestamp - previous.timestamp : 0;
    const startsNewSegment = Boolean(previous) && (forceNewSegment || delta <= 0 || delta > TRACE_GAP_BREAK_MS);
    const nextStarts = [...segmentStartIndicesRef.current];
    const nextPositions = [...positionsRef.current, position];

    if (startsNewSegment) {
      nextStarts.push(nextPositions.length - 1);
    } else if (previous) {
      distanceTravelledRef.current += distanceNm(previous, position);
    }

    const compacted = compactSegmentedTrace(nextPositions, nextStarts, TRACE_MAX_POINTS);
    positionsRef.current = compacted.positions;
    segmentStartIndicesRef.current = compacted.segmentStartIndices;
    lastTraceSampleAt.current = position.timestamp;
    lastTraceSample.current = position;

    if (compacted.compacted) {
      distanceTravelledRef.current = computeTraceMetrics(
        compacted.positions,
        compacted.segmentStartIndices,
        true
      ).distanceNm;
    }

    setPositions(compacted.positions);
    setSegmentStartIndices(compacted.segmentStartIndices);
    setDistanceTravelledNm(distanceTravelledRef.current);
    commitDiagnostics({ ...diagnosticsRef.current, tracePoints: compacted.positions.length });
    return true;
  };

  const ingestPosition = (position: GpsPosition, forceTraceSample = false) => {
    const receivedAt = Date.now();
    if (gapOpen.current) {
      gapOpen.current = false;
      bumpDiagnostics('gpsResumptions');
    }

    setLastAccuracy(position.precision);
    setLastAltitudeAccuracy(position.altitudeAccuracy);
    setLastSignalAgeSec(0);
    lastSignalAt.current = receivedAt;
    bumpDiagnostics('rawReceived');

    if (position.altitude === null) {
      bumpDiagnostics('missingAltitude');
    } else if (!isReliableGpsAltitude(position)) {
      bumpDiagnostics('unreliableAltitude');
    }

    if (!isPlausibleGpsPosition(position)) {
      bumpDiagnostics('rejectedPrecision');
      return;
    }

    const previousLive = lastLivePosition.current;
    updateObservedSpeed(position, previousLive);
    lastLivePosition.current = position;
    setCurrentPosition(position);

    const nextCrossTrack = getProgressiveCrossTrackError(position, route.points, activeSegmentIndex.current);
    activeSegmentIndex.current = nextCrossTrack.segmentIndex;
    setCrossTrack(nextCrossTrack);

    const previousTraceSample = lastTraceSample.current;
    const reason = forceTraceSample ? null : classifyGpsPosition(position, previousTraceSample);

    if (forceTraceSample) {
      traceRejectionStreak.current = 0;
      groundAnchor.current = null;
      lastValidatedTracePosition.current = position;
      appendTraceSample(position, true);
      return;
    }

    if (reason === null) {
      const isLowReportedSpeed = position.vitesse !== null && position.vitesse < STATIONARY_SPEED_KT_THRESHOLD;

      if (isLowReportedSpeed && groundAnchor.current) {
        const driftM = distanceNm(groundAnchor.current, position) * 1852;
        if (driftM <= STATIONARY_DRIFT_RADIUS_M) {
          bumpDiagnostics('rejectedDrift');
          return;
        }
      }

      traceRejectionStreak.current = 0;
      groundAnchor.current = isLowReportedSpeed ? position : null;
      lastValidatedTracePosition.current = position;
      appendTraceSample(position);
      return;
    }

    if (reason === 'redundant') {
      bumpDiagnostics('rejectedRedundant');
      return;
    }

    if (reason === 'speed') {
      bumpDiagnostics('rejectedSpeed');
      if (previousTraceSample) {
        traceRejectionStreak.current += 1;
        if (traceRejectionStreak.current >= MAX_CONSECUTIVE_TRACE_REJECTIONS) {
          traceRejectionStreak.current = 0;
          groundAnchor.current = null;
          lastValidatedTracePosition.current = position;
          appendTraceSample(position, true, true);
          bumpDiagnostics('forcedResync');
        }
      }
    }
  };

  const handleNativePosition = (nativePosition: GeolocationPosition) => {
    updateStatus('active');
    setErrorMessage(null);
    ingestPosition(toGpsPosition(nativePosition));
  };

  const startGps = () => {
    if (!isRouteReady(route)) {
      updateStatus('idle');
      setErrorMessage('Définissez un départ et une arrivée avant de démarrer le suivi.');
      return;
    }

    clearGpsWatch();
    clearSimulation();
    setErrorMessage(null);
    resetTrackingData();
    sessionSourceRef.current = 'web';
    startTime.current = Date.now();
    setRecordingStartedAt(startTime.current);
    setRecordingElapsedSec(0);

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

        if (lastSignalAt.current !== null) {
          updateStatus('degraded');
          setErrorMessage('Signal GPS momentanément faible. Le suivi reprendra au prochain fix.');
        } else {
          setErrorMessage('Recherche GPS en cours. Placez le téléphone près d’une fenêtre ou en extérieur si le signal tarde.');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );
  };

  const startSimulation = () => {
    if (!isRouteReady(route)) {
      updateStatus('idle');
      setErrorMessage('Définissez un départ et une arrivée avant de lancer la simulation.');
      return;
    }
    clearGpsWatch();
    clearSimulation();
    updateStatus('simulating');
    setErrorMessage(null);
    resetTrackingData();
    sessionSourceRef.current = 'simulation';
    startTime.current = Date.now();
    setRecordingStartedAt(startTime.current);
    setRecordingElapsedSec(0);
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

  const stopAndSave = async (): Promise<TraceSaveResult> => {
    const finalValidated = lastValidatedTracePosition.current;
    if (finalValidated && !samePosition(lastTraceSample.current, finalValidated)) {
      appendTraceSample(finalValidated, true);
    }
    const finalPositions = positionsRef.current;
    const finalStarts = segmentStartIndicesRef.current;

    if (finalPositions.length < 2) {
      clearGpsWatch();
      clearSimulation();
      startTime.current = null;
      setRecordingStartedAt(null);
      updateStatus('stopped');
      const result: TraceSaveResult = {
        ok: false,
        mode: 'indexeddb',
        message: 'Enregistrement arrêté. Trace trop courte pour être sauvegardée.'
      };
      setErrorMessage(result.message);
      return result;
    }

    clearGpsWatch();
    clearSimulation();
    updateStatus('saving');

    const metrics = computeTraceMetrics(finalPositions, finalStarts, true);
    const finalDiagnostics = { ...diagnosticsRef.current, tracePoints: finalPositions.length };
    commitDiagnostics(finalDiagnostics);
    const endedAt = new Date().toISOString();
    const startedAt = new Date(startTime.current ?? finalPositions[0]?.timestamp ?? Date.now()).toISOString();
    const trace: Trace = {
      schemaVersion: 4,
      id: `trace-${Date.now()}`,
      routeId: route.id,
      routeName: route.nom,
      date: endedAt,
      startedAt,
      endedAt,
      source: sessionSourceRef.current,
      positions: finalPositions,
      segmentStartIndices: metrics.segmentStartIndices,
      plannedRoute: createPlannedRouteSnapshot(route, new Date(startedAt)),
      dureeSec: metrics.durationSec,
      distanceNm: Number(metrics.distanceNm.toFixed(2)),
      diagnostics: finalDiagnostics
    };

    const result = await onTraceReady(trace);
    setPositions(finalPositions);
    setSegmentStartIndices(metrics.segmentStartIndices);
    setDistanceTravelledNm(metrics.distanceNm);
    distanceTravelledRef.current = metrics.distanceNm;
    if (result.ok) {
      updateStatus('saved');
      hasUnsavedTraceRef.current = false;
      setErrorMessage(result.message);
      startTime.current = null;
      setRecordingStartedAt(null);
    } else {
      updateStatus('save-error');
      setErrorMessage(result.message);
    }
    return result;
  };

  useEffect(() => {
    const recordingStatus = status === 'requesting'
      || status === 'active'
      || status === 'degraded'
      || status === 'frozen'
      || status === 'simulating';

    if (!recordingStatus || recordingStartedAt === null) return undefined;

    const updateElapsed = () => {
      setRecordingElapsedSec(Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000)));
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [recordingStartedAt, status]);

  useEffect(() => {
    if (watchId.current === null) return undefined;

    const timer = window.setInterval(() => {
      const signalAt = lastSignalAt.current;
      if (signalAt === null) return;
      const ageMs = Date.now() - signalAt;
      setLastSignalAgeSec(Math.max(0, Math.floor(ageMs / 1000)));

      if (ageMs >= TRACE_GAP_BREAK_MS && !gapOpen.current) {
        gapOpen.current = true;
        bumpDiagnostics('gpsGaps');
      }

      if (ageMs >= GPS_FROZEN_AFTER_MS) {
        updateStatus('frozen');
        setErrorMessage('Position GPS figée depuis plus de 30 secondes. La trace reste ouverte mais aucun nouveau fix fiable n’est reçu.');
      } else if (ageMs >= GPS_DEGRADED_AFTER_MS) {
        updateStatus('degraded');
        setErrorMessage('Signal GPS dégradé. Dernier fix reçu il y a plus de 10 secondes.');
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    activeSegmentIndex.current = null;
    setCrossTrack(getCrossTrackError(currentPosition, route.points));
  }, [route.points]);

  useEffect(() => {
    hasUnsavedTraceRef.current = sessionNeedsConfirmation(status);
  }, [status, positions.length]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedTraceRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    return () => {
      clearGpsWatch();
      clearSimulation();
    };
  }, []);

  const nextPoint = route.points[crossTrack.segmentIndex + 1] ?? route.points.at(-1) ?? null;
  const nextPointDistance = currentPosition && nextPoint ? distanceNm(currentPosition, nextPoint) : null;
  const hasUnsavedTrace = sessionNeedsConfirmation(status);

  return {
    status,
    positions,
    segmentStartIndices,
    currentPosition,
    crossTrack,
    distanceTravelledNm,
    nextPoint,
    nextPointDistance,
    errorMessage,
    lastAccuracy,
    lastAltitudeAccuracy,
    lastSignalAgeSec,
    lastSignalAt: lastSignalAt.current,
    diagnostics,
    traceSampleIntervalMs: TRACE_SAMPLE_INTERVAL_MS,
    traceMaxPoints: TRACE_MAX_POINTS,
    recordingStartedAt,
    recordingElapsedSec,
    hasUnsavedTrace,
    startGps,
    startSimulation,
    stopAndSave
  };
}
