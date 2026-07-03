import { useEffect, useMemo, useRef, useState } from 'react';
import type { GpsPosition, GpsStatus, GpsTraceDiagnostics } from '../domain/gps.types';
import type { NavRoute } from '../domain/navigation.types';
import type { Trace } from '../domain/trace.types';
import { distanceNm, totalDistanceNm } from '../services/geo/distance';
import {
  toGpsPosition,
  isPlausibleGpsPosition,
  classifyGpsPosition
} from '../services/gps/geolocationService';
import { interpolateSimulationPoint, simulationTotalSteps } from '../services/gps/simulationService';
import { getCrossTrackError, getProgressiveCrossTrackError, type CrossTrackResult } from '../services/geo/crossTrackError';

const TRACE_SAMPLE_INTERVAL_MS = 3000;
const TRACE_MAX_POINTS = 4200;

// Nombre de points consécutifs rejetés pour vitesse implausible avant de
// forcer leur ajout à la trace. Un vrai saut GPS isolé est ainsi filtré,
// mais si la position "de référence" est en fait périmée (ex. après une
// longue coupure signal), on ne reste pas bloqué indéfiniment à comparer
// tout nouveau point à ce point obsolète.
const MAX_CONSECUTIVE_TRACE_REJECTIONS = 5;

const emptyDiagnostics = (): GpsTraceDiagnostics => ({
  rawReceived: 0,
  rejectedPrecision: 0,
  rejectedRedundant: 0,
  rejectedSpeed: 0,
  rejectedDrift: 0,
  forcedResync: 0,
  tracePoints: 0
});

// Sous ce seuil de vitesse sol *annoncée par le GPS* (Doppler, indépendante
// du bruit de position), on considère l'appareil essentiellement immobile
// (parqué, point d'attente). Un déplacement de position malgré une vitesse
// quasi nulle est alors un rebond multitrajet (hangars, avions parqués),
// pas un vrai mouvement.
const STATIONARY_SPEED_KT_THRESHOLD = 5;
// Rayon en dessous duquel, en régime "immobile", on ignore le déplacement
// de position comme du bruit plutôt que de l'ajouter à la trace.
const STATIONARY_DRIFT_RADIUS_M = 60;

export function useGpsTracking(route: NavRoute, onTraceReady: (trace: Trace) => void) {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [positions, setPositions] = useState<GpsPosition[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GpsPosition | null>(null);
  const [crossTrack, setCrossTrack] = useState<CrossTrackResult>(() => getCrossTrackError(null, route.points));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const [lastAltitudeAccuracy, setLastAltitudeAccuracy] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<number | null>(null);
  const simStep = useRef(0);
  const startTime = useRef<number | null>(null);
  const statusRef = useRef<GpsStatus>('idle');
  const lastSignalAt = useRef<number | null>(null);
  const lastLivePosition = useRef<GpsPosition | null>(null);
  const lastTraceSampleAt = useRef<number | null>(null);
  const activeSegmentIndex = useRef<number | null>(null);
  const traceRejectionStreak = useRef(0);
  const groundAnchor = useRef<GpsPosition | null>(null);
  const lastTraceSample = useRef<GpsPosition | null>(null);
  const [diagnostics, setDiagnostics] = useState<GpsTraceDiagnostics>(emptyDiagnostics);
  const diagnosticsRef = useRef<GpsTraceDiagnostics>(emptyDiagnostics());

  const bumpDiagnostics = (key: keyof GpsTraceDiagnostics) => {
    diagnosticsRef.current = { ...diagnosticsRef.current, [key]: diagnosticsRef.current[key] + 1 };
    setDiagnostics(diagnosticsRef.current);
  };

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
    setLastAltitudeAccuracy(null);
    lastSignalAt.current = null;
    lastLivePosition.current = null;
    lastTraceSampleAt.current = null;
    activeSegmentIndex.current = null;
    traceRejectionStreak.current = 0;
    groundAnchor.current = null;
    lastTraceSample.current = null;
    diagnosticsRef.current = emptyDiagnostics();
    setDiagnostics(diagnosticsRef.current);
    setCrossTrack(getCrossTrackError(null, route.points));
  };

  const appendTraceSample = (position: GpsPosition, force = false) => {
    const previousSampleAt = lastTraceSampleAt.current;
    const shouldSample = force || previousSampleAt === null || position.timestamp - previousSampleAt >= TRACE_SAMPLE_INTERVAL_MS;
    if (!shouldSample) return;

    lastTraceSampleAt.current = position.timestamp;
    lastTraceSample.current = position;
    setPositions((current) => [...current, position].slice(-TRACE_MAX_POINTS));
  };

  const ingestPosition = (position: GpsPosition, forceTraceSample = false) => {
    setLastAccuracy(position.precision);
    setLastAltitudeAccuracy(position.altitudeAccuracy);
    lastSignalAt.current = Date.now();
    bumpDiagnostics('rawReceived');

    if (!isPlausibleGpsPosition(position)) {
      bumpDiagnostics('rejectedPrecision');
      return;
    }

    lastLivePosition.current = position;
    setCurrentPosition(position);

    const nextCrossTrack = getProgressiveCrossTrackError(position, route.points, activeSegmentIndex.current);
    activeSegmentIndex.current = nextCrossTrack.segmentIndex;
    setCrossTrack(nextCrossTrack);

    // IMPORTANT : on lit `lastTraceSample.current` (une ref), pas `positions`
    // (le state React). `ingestPosition` est appelée depuis le callback passé
    // une seule fois à `navigator.geolocation.watchPosition` — ce callback
    // garde tout le vol la valeur de `positions` telle qu'elle était à l'appel
    // de `startGps()` (closure figée). Résultat : `positions.at(-1)` valait
    // toujours `null`/le tout premier point, et TOUT le filtrage par
    // vitesse/redondance ci-dessous ne s'exécutait jamais réellement — seul
    // le throttle 3s de `appendTraceSample` agissait. La ref, elle, est
    // toujours à jour quel que soit l'âge de la closure qui la lit.
    const previousTraceSample = lastTraceSample.current;
    const reason = forceTraceSample ? null : classifyGpsPosition(position, previousTraceSample);

    if (forceTraceSample) {
      traceRejectionStreak.current = 0;
      groundAnchor.current = null;
      appendTraceSample(position, true);
      bumpDiagnostics('tracePoints');
    } else if (reason === null) {
      const reportedSpeedKt = position.vitesse;
      const isLowReportedSpeed = reportedSpeedKt !== null && reportedSpeedKt < STATIONARY_SPEED_KT_THRESHOLD;

      if (isLowReportedSpeed && groundAnchor.current) {
        const driftM = distanceNm(groundAnchor.current, position) * 1852;
        if (driftM <= STATIONARY_DRIFT_RADIUS_M) {
          // Vitesse Doppler quasi nulle mais position qui bouge de plusieurs
          // dizaines de mètres : rebond multitrajet typique près des hangars
          // ou d'avions parqués, pas un vrai déplacement. On n'ajoute pas ce
          // point à la trace ; la position live, elle, continue de se
          // rafraîchir normalement.
          bumpDiagnostics('rejectedDrift');
          return;
        }
      }

      traceRejectionStreak.current = 0;
      groundAnchor.current = isLowReportedSpeed ? position : null;
      appendTraceSample(position);
      bumpDiagnostics('tracePoints');
    } else if (reason === 'redundant') {
      // Point normal mais trop rapproché : rien à faire, ce n'est pas un rejet
      // "GPS louche", donc ça ne compte pas dans le compteur de resync.
      bumpDiagnostics('rejectedRedundant');
    } else if (reason === 'speed') {
      // Saut de vitesse implausible : on ignore ce point pour ne pas polluer
      // la trace, sauf si ça se répète trop souvent — signe que la référence
      // elle-même est périmée (ex. après une coupure GPS prolongée), auquel
      // cas on force le resync plutôt que de rester bloqué.
      bumpDiagnostics('rejectedSpeed');
      if (previousTraceSample) {
        traceRejectionStreak.current += 1;
        if (traceRejectionStreak.current >= MAX_CONSECUTIVE_TRACE_REJECTIONS) {
          traceRejectionStreak.current = 0;
          groundAnchor.current = null;
          appendTraceSample(position, true);
          bumpDiagnostics('forcedResync');
          bumpDiagnostics('tracePoints');
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
      distanceNm: Number(totalDistanceNm(finalPositions).toFixed(2)),
      diagnostics: diagnosticsRef.current
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
    lastAltitudeAccuracy,
    lastSignalAt: lastSignalAt.current,
    diagnostics,
    traceSampleIntervalMs: TRACE_SAMPLE_INTERVAL_MS,
    traceMaxPoints: TRACE_MAX_POINTS,
    startGps,
    startSimulation,
    stopAndSave
  };
}
