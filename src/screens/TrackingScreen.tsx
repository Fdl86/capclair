import { useEffect, useRef, useState } from 'react';
import type { NavPoint, NavRoute } from '../domain/navigation.types';
import type { Trace } from '../domain/trace.types';
import { useGpsTracking } from '../hooks/useGpsTracking';
import { OpenLayersMap } from '../components/map/OpenLayersMap';
import { MapLayerToggle } from '../components/map/MapLayerToggle';
import { CockpitBadge } from '../components/cockpit/CockpitBadge';
import { MetricCard } from '../components/cockpit/MetricCard';
import { RouteDeviationGauge } from '../components/cockpit/RouteDeviationGauge';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Card } from '../components/ui/Card';
import { distanceNm } from '../services/geo/distance';
import type { GpsPosition } from '../domain/gps.types';
import type { MapBaseLayer } from '../mapEngine/mapTypes';

interface TrackingScreenProps {
  route: NavRoute;
  onTraceReady: (trace: Trace) => void;
  mapBaseLayer: MapBaseLayer;
  onMapBaseLayerChange: (value: MapBaseLayer) => void;
}

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return 'GPS OK';
    case 'simulating': return 'SIM OK';
    case 'simulation-complete': return 'SIM terminée';
    case 'requesting': return 'Recherche GPS';
    case 'denied': return 'GPS refusé';
    case 'unavailable': return 'GPS perdu';
    case 'stopped': return 'Sauvé';
    default: return 'GPS prêt';
  }
}

function formatClock(date = new Date()): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return hours > 0 ? `${hours}:${String(mins).padStart(2, '0')}` : `${mins} min`;
}

function routePointDistanceRemainingNm(route: NavRoute, currentPosition: GpsPosition | null, nextPoint: NavPoint | null, segmentIndex: number) {
  if (!currentPosition || !nextPoint || route.points.length < 2) return null;

  const nextPointIndex = Math.min(Math.max(segmentIndex + 1, 1), route.points.length - 1);
  let remaining = distanceNm(currentPosition, nextPoint);

  for (let index = nextPointIndex; index < route.points.length - 1; index += 1) {
    remaining += distanceNm(route.points[index], route.points[index + 1]);
  }

  return remaining;
}

function metricNumber(value: number | null | undefined, suffix: string, digits = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return `${value.toFixed(digits).replace('.', ',')} ${suffix}`;
}

export function TrackingScreen({ route, onTraceReady, mapBaseLayer, onMapBaseLayerChange }: TrackingScreenProps) {
  const [confirmStop, setConfirmStop] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const gps = useGpsTracking(route, onTraceReady);
  const isRecording = gps.status === 'active' || gps.status === 'simulating';
  const canSaveTrace = isRecording || gps.status === 'simulation-complete';
  const traceForMap = gps.positions;

  useEffect(() => {
    let cancelled = false;

    const releaseWakeLock = async () => {
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      setWakeLockActive(false);
      if (sentinel && !sentinel.released) {
        try {
          await sentinel.release();
        } catch {
          // Wake Lock release can fail silently on some mobile browsers.
        }
      }
    };

    const requestWakeLock = async () => {
      const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
      if (!isRecording || wakeLockRef.current || !navigatorWithWakeLock.wakeLock) {
        setWakeLockActive(Boolean(wakeLockRef.current));
        return;
      }

      try {
        const sentinel = await navigatorWithWakeLock.wakeLock.request('screen');
        if (cancelled || !isRecording) {
          await sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        sentinel.addEventListener?.('release', () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null;
            setWakeLockActive(false);
          }
        });
      } catch {
        setWakeLockActive(false);
      }
    };

    if (isRecording) {
      void requestWakeLock();
    } else {
      void releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRecording && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void releaseWakeLock();
    };
  }, [isRecording]);

  const currentBranch = route.branches[gps.crossTrack.segmentIndex] ?? route.branches[0] ?? null;
  const magneticHeading = currentBranch ? Math.round(currentBranch.capCorrige) : null;

  const groundSpeed = gps.currentPosition?.vitesse ?? null;
  const altitude = gps.currentPosition?.altitude ?? null;
  const currentTrack = gps.currentPosition?.track ?? null;
  const remainingDistanceNm = routePointDistanceRemainingNm(route, gps.currentPosition, gps.nextPoint, gps.crossTrack.segmentIndex);
  const eteMinutes = groundSpeed && groundSpeed > 5 && remainingDistanceNm !== null
    ? (remainingDistanceNm / groundSpeed) * 60
    : null;
  const eta = eteMinutes !== null ? new Date(Date.now() + eteMinutes * 60000) : null;

  return (
    <section className="tracking-screen">
      <div className="tracking-map-panel">
        <MapLayerToggle baseLayer={mapBaseLayer} onChange={onMapBaseLayerChange} />
        <OpenLayersMap
          route={route}
          trace={traceForMap}
          aircraft={gps.currentPosition}
          selectedPointId={gps.nextPoint?.id ?? null}
          compact
          baseLayer={mapBaseLayer}
          followAircraft={isRecording}
        />
      </div>

      <aside className="tracking-panel">
        <div className="cockpit-badges">
          <CockpitBadge label={statusLabel(gps.status)} state={gps.status === 'active' || gps.status === 'simulating' ? 'ok' : gps.status === 'requesting' || gps.status === 'simulation-complete' ? 'warn' : 'off'} />
          <CockpitBadge label={isRecording ? 'Trace REC' : gps.status === 'simulation-complete' ? 'Trace à sauver' : 'Trace prête'} state={isRecording ? 'rec' : gps.status === 'simulation-complete' ? 'warn' : 'off'} />
          <CockpitBadge label={wakeLockActive ? 'Écran actif' : isRecording ? 'Écran veille?' : 'Écran prêt'} state={wakeLockActive ? 'ok' : isRecording ? 'warn' : 'off'} />
        </div>

        {(gps.status === 'requesting' || gps.lastAccuracy !== null) && (
          <Card className="gps-signal-card">
            <strong>{gps.status === 'requesting' ? 'Recherche position GPS...' : 'Position GPS reçue'}</strong>
            <p>
              {gps.lastAccuracy !== null
                ? `Précision ${Math.round(gps.lastAccuracy)} m`
                : 'Acquisition haute précision en cours. Le premier fix peut prendre quelques secondes.'}
            </p>
            {isRecording && (
              <p className="gps-diagnostics">
                Reçus {gps.diagnostics.rawReceived} · trace {gps.diagnostics.tracePoints} · rejetés précision {gps.diagnostics.rejectedPrecision} · rejetés saut {gps.diagnostics.rejectedSpeed}
              </p>
            )}
          </Card>
        )}

        <div className="tracking-metrics-top">
          <MetricCard
            label="Prochain point"
            value={gps.nextPoint?.nom ?? '--'}
            detail={gps.nextPointDistance !== null ? `${gps.nextPointDistance.toFixed(1).replace('.', ',')} NM` : '--'}
            strong
          />
          <MetricCard label="Cap magnétique" value={magneticHeading !== null ? `${magneticHeading}°` : '--'} strong />
          <MetricCard label="ETA" value={eta ? formatClock(eta) : '--'} detail={eteMinutes !== null ? `dans ${formatDuration(eteMinutes)}` : '--'} strong />
        </div>

        <RouteDeviationGauge result={gps.crossTrack} />

        {gps.errorMessage && (
          <Card className="gps-warning">
            <strong>État GPS</strong>
            <p>{gps.errorMessage}</p>
          </Card>
        )}

        <div className="cockpit-value-grid">
          <MetricCard label="GS" value={metricNumber(groundSpeed, 'kt')} />
          <MetricCard label="ALT" value={altitude !== null ? `${Math.round(altitude * 3.28084).toLocaleString('fr-FR')} ft` : '--'} />
          <MetricCard label="TRK GPS" value={currentTrack !== null ? `${Math.round(currentTrack)}°` : '--'} />
          <MetricCard label="ETE dest" value={eteMinutes !== null ? formatDuration(eteMinutes) : '--'} />
        </div>


        <div className="tracking-actions">
          {!canSaveTrace && <Button variant="primary" onClick={gps.startGps}>Démarrer GPS</Button>}
          {!canSaveTrace && <Button variant="secondary" onClick={gps.startSimulation}>Tester simulation</Button>}
          {canSaveTrace && <Button variant="danger" onClick={() => setConfirmStop(true)}>Arrêter et sauvegarder</Button>}
        </div>
      </aside>

      <ConfirmDialog
        open={confirmStop}
        title="Arrêter le suivi ?"
        message="La trace actuelle sera sauvegardée localement. Cette action met fin à l'enregistrement."
        confirmLabel="Arrêter"
        onCancel={() => setConfirmStop(false)}
        onConfirm={() => {
          setConfirmStop(false);
          gps.stopAndSave();
        }}
      />
    </section>
  );
}
