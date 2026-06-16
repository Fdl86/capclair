import { useMemo, useState } from 'react';
import type { NavRoute } from '../domain/navigation.types';
import type { Trace } from '../domain/trace.types';
import { useGpsTracking } from '../hooks/useGpsTracking';
import { OpenLayersMap } from '../components/map/OpenLayersMap';
import { CockpitBadge } from '../components/cockpit/CockpitBadge';
import { MetricCard } from '../components/cockpit/MetricCard';
import { RouteDeviationGauge } from '../components/cockpit/RouteDeviationGauge';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Card } from '../components/ui/Card';
import { mockZones } from '../data/mockZones';

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

function formatTime(date = new Date()): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function TrackingScreen({ route, onTraceReady }: TrackingScreenProps) {
  const [confirmStop, setConfirmStop] = useState(false);
  const gps = useGpsTracking(route, onTraceReady);
  const isRecording = gps.status === 'active' || gps.status === 'simulating';
  const currentTrack = gps.currentPosition?.track ?? 118;
  const groundSpeed = gps.currentPosition?.vitesse ?? 102;
  const altitude = gps.currentPosition?.altitude ?? 1050;
  const nextZone = mockZones.find((zone) => zone.statut === 'traversee') ?? mockZones[0];
  const traceForMap = useMemo(() => gps.positions, [gps.positions]);

  return (
    <section className="tracking-screen">
      <div className="tracking-map-panel">
        <OpenLayersMap route={route} trace={traceForMap} aircraft={gps.currentPosition} selectedPointId={gps.nextPoint?.id ?? null} compact />
      </div>

      <aside className="tracking-panel">
        <div className="cockpit-badges">
          <CockpitBadge label={statusLabel(gps.status)} state={gps.status === 'active' || gps.status === 'simulating' ? 'ok' : gps.status === 'requesting' ? 'warn' : 'off'} />
          <CockpitBadge label={isRecording ? 'Trace REC' : 'Trace prête'} state={isRecording ? 'rec' : 'off'} />
          <CockpitBadge label="Météo mock" state="warn" />
          <CockpitBadge label="Données DEV01" state="warn" />
        </div>

        <div className="tracking-metrics-top">
          <MetricCard label="Prochain point" value={gps.nextPoint?.nom ?? 'WPT2'} detail={`${gps.nextPointDistance.toFixed(1).replace('.', ',')} NM`} strong />
          <MetricCard label="Cap corrigé" value="121°" strong />
          <MetricCard label="ETA" value={formatTime()} detail="dans 18 min" strong />
        </div>

        <RouteDeviationGauge result={gps.crossTrack} />

        {gps.errorMessage && (
          <Card className="gps-warning">
            <strong>État GPS</strong>
            <p>{gps.errorMessage}</p>
          </Card>
        )}

        <div className="cockpit-value-grid">
          <MetricCard label="GS" value={`${Math.round(groundSpeed)} kt`} />
          <MetricCard label="ALT" value={`${Math.round(altitude * 3.28084).toLocaleString('fr-FR')} ft`} />
          <MetricCard label="TRK" value={`${Math.round(currentTrack)}°`} />
          <MetricCard label="ETE dest" value="0:42" />
        </div>

        <Card className="next-zone-card">
          <span>Prochaine zone</span>
          <strong>{nextZone.nom}</strong>
          <p>{nextZone.plancher} / {nextZone.plafond} - Traversée dans 14 NM</p>
        </Card>

        <div className="tracking-actions">
          {!isRecording && <Button variant="primary" onClick={gps.startGps}>Démarrer GPS</Button>}
          {!isRecording && <Button variant="secondary" onClick={gps.startSimulation}>Tester simulation</Button>}
          {isRecording && <Button variant="danger" onClick={() => setConfirmStop(true)}>Arrêter et sauvegarder</Button>}
        </div>
      </aside>

      <ConfirmDialog
        open={confirmStop}
        title="Arrêter le suivi ?"
        message="La trace actuelle sera sauvegardée localement. Cette action met fin à l’enregistrement DEV01."
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
