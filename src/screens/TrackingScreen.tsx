import { useMemo, useState } from 'react';
import type { NavPoint, NavRoute } from '../domain/navigation.types';
import type { Trace } from '../domain/trace.types';
import { useGpsTracking } from '../hooks/useGpsTracking';
import { OpenLayersMap } from '../components/map/OpenLayersMap';
import { CockpitBadge } from '../components/cockpit/CockpitBadge';
import { MetricCard } from '../components/cockpit/MetricCard';
import { RouteDeviationGauge } from '../components/cockpit/RouteDeviationGauge';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Card } from '../components/ui/Card';
import { bearingDeg } from '../services/geo/bearing';
import { distanceNm } from '../services/geo/distance';
import type { GpsPosition } from '../domain/gps.types';

interface TrackingScreenProps {
  route: NavRoute;
  onTraceReady: (trace: Trace) => void;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return 'GPS OK';
    case 'simulating': return 'SIM OK';
    case 'requesting': return 'GPS...';
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

export function TrackingScreen({ route, onTraceReady }: TrackingScreenProps) {
  const [confirmStop, setConfirmStop] = useState(false);
  const [showLiveHeading, setShowLiveHeading] = useState(false);
  const gps = useGpsTracking(route, onTraceReady);
  const isRecording = gps.status === 'active' || gps.status === 'simulating';
  const traceForMap = useMemo(() => gps.positions, [gps.positions]);

  const headingToNext = gps.currentPosition && gps.nextPoint
    ? Math.round(bearingDeg(gps.currentPosition, gps.nextPoint))
    : null;

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
        <OpenLayersMap route={route} trace={traceForMap} aircraft={gps.currentPosition} selectedPointId={gps.nextPoint?.id ?? null} compact />
      </div>

      <aside className="tracking-panel">
        <div className="cockpit-badges">
          <CockpitBadge label={statusLabel(gps.status)} state={gps.status === 'active' || gps.status === 'simulating' ? 'ok' : gps.status === 'requesting' ? 'warn' : 'off'} />
          <CockpitBadge label={isRecording ? 'Trace REC' : 'Trace prête'} state={isRecording ? 'rec' : 'off'} />
        </div>

        {showLiveHeading && (
          <Card className="live-heading-card">
            <span>Cap GPS live</span>
            <strong>{currentTrack !== null ? `${Math.round(currentTrack)}°` : '--'}</strong>
            <small>{currentTrack !== null ? 'Donnée GPS de déplacement' : 'Disponible uniquement en mouvement GPS'}</small>
          </Card>
        )}

        <div className="tracking-metrics-top">
          <MetricCard
            label="Prochain point"
            value={gps.nextPoint?.nom ?? '--'}
            detail={gps.nextPointDistance !== null ? `${gps.nextPointDistance.toFixed(1).replace('.', ',')} NM` : '--'}
            strong
          />
          <MetricCard label="Cap point" value={headingToNext !== null ? `${headingToNext}°` : '--'} strong />
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
          <MetricCard label="TRK" value={currentTrack !== null ? `${Math.round(currentTrack)}°` : '--'} />
          <MetricCard label="ETE dest" value={eteMinutes !== null ? formatDuration(eteMinutes) : '--'} />
        </div>

        <Card className="next-zone-card">
          <span>Prochaine zone</span>
          <strong>--</strong>
          <p>Calcul en suivi à raccorder au moteur zones.</p>
        </Card>

        <div className="tracking-actions">
          {!isRecording && <Button variant="primary" onClick={gps.startGps}>Démarrer GPS</Button>}
          {!isRecording && <Button variant="secondary" onClick={gps.startSimulation}>Tester simulation</Button>}
          <Button variant="secondary" onClick={() => setShowLiveHeading((value) => !value)}>{showLiveHeading ? 'Masquer cap live' : 'Cap live'}</Button>
          {isRecording && <Button variant="danger" onClick={() => setConfirmStop(true)}>Arrêter et sauvegarder</Button>}
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
