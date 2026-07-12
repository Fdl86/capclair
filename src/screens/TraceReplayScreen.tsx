import '../styles/replay.css';
import { useMemo, useState } from 'react';
import type { Trace } from '../domain/trace.types';
import type { MapBaseLayer } from '../mapEngine/mapTypes';
import { AltitudeProfile } from '../components/replay/AltitudeProfile';
import { ReplayPlaybackOverlay, ReplaySpeedControls } from '../components/replay/ReplayControls';
import { ReplayMap } from '../components/replay/ReplayMap';
import { MapLayerToggle } from '../components/map/MapLayerToggle';
import { useTraceReplay } from '../hooks/useTraceReplay';
import { buildReplayModel } from '../services/replay/traceReplayModel';
import { getCrossTrackError } from '../services/geo/crossTrackError';

interface TraceReplayScreenProps {
  trace: Trace;
  mapBaseLayer: MapBaseLayer;
  onMapBaseLayerChange: (value: MapBaseLayer) => void;
  onBack: () => void;
}

function metric(value: number | null | undefined, suffix: string, digits = 0): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return `${value.toFixed(digits).replace('.', ',')} ${suffix}`;
}

function formatGap(durationMs: number): string {
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes > 0 ? `${minutes} min ${String(remaining).padStart(2, '0')} s` : `${remaining} s`;
}

function traceSourceLabel(trace: Trace): string {
  if (trace.source === 'gpx-import') return 'GPX importé';
  if (trace.source === 'simulation') return 'Simulation';
  if (trace.source === 'web') return 'GPS web';
  return 'Trace locale';
}

export function TraceReplayScreen({ trace, mapBaseLayer, onMapBaseLayerChange, onBack }: TraceReplayScreenProps) {
  const model = useMemo(() => buildReplayModel(trace), [trace]);
  const replay = useTraceReplay(model);
  const hasPlannedRoute = (trace.plannedRoute?.points.length ?? 0) >= 2;
  const [showPlannedRoute, setShowPlannedRoute] = useState(hasPlannedRoute);
  const [followAircraft, setFollowAircraft] = useState(true);
  const plannedPoints = trace.plannedRoute?.points ?? [];
  const crossTrack = replay.sample && hasPlannedRoute ? getCrossTrackError(replay.sample.position, plannedPoints) : null;
  const referenceDate = trace.startedAt ?? trace.importMetadata?.importedAt ?? trace.date;
  const traceDate = new Date(referenceDate);
  const dateLabel = Number.isNaN(traceDate.getTime())
    ? ''
    : traceDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

  if (model.points.length < 2) {
    return (
      <section className="replay-screen replay-unavailable">
        <header className="replay-header">
          <button type="button" className="replay-back" onClick={onBack} aria-label="Retour aux traces">‹</button>
          <div><span>Replay</span><strong>{trace.routeName}</strong></div>
        </header>
        <div className="replay-empty">
          <strong>Replay indisponible</strong>
          <p>Cette trace ne contient pas assez de positions valides.</p>
          <button type="button" className="btn btn-secondary" onClick={onBack}>Retour aux traces</button>
        </div>
      </section>
    );
  }

  return (
    <section className="replay-screen">
      <header className="replay-header">
        <button type="button" className="replay-back" onClick={onBack} aria-label="Retour aux traces">‹</button>
        <div className="replay-title">
          <span>Replay</span>
          <strong>{trace.routeName}</strong>
          <div className="replay-source-line">
            <em>{traceSourceLabel(trace)}</em>
            {trace.importMetadata?.fileName && <small title={trace.importMetadata.fileName}>{trace.importMetadata.fileName}</small>}
          </div>
        </div>
        <div className="replay-date">
          <strong>{dateLabel}</strong>
          <span>{model.points.length.toLocaleString('fr-FR')} points · {model.segments.length} segment{model.segments.length > 1 ? 's' : ''}</span>
        </div>
      </header>


      <div className="replay-metrics">
        <div>
          <span>Heure</span>
          <strong>{model.temporalAvailable && replay.sample ? new Date(replay.sample.timestamp).toLocaleTimeString('fr-FR') : '--'}</strong>
          {!model.temporalAvailable && <small>Non horodaté</small>}
        </div>
        <div><span>Vitesse sol</span><strong>{metric(replay.sample?.speedKt, 'kt')}</strong></div>
        <div><span>Altitude GPS</span><strong>{metric(replay.sample?.altitudeFt, 'ft')}</strong></div>
        <div><span>Distance</span><strong>{metric(replay.sample?.cumulativeDistanceNm, 'NM', 1)}</strong><small>sur {model.totalDistanceNm.toFixed(1).replace('.', ',')} NM</small></div>
      </div>

      <div className="replay-map-panel">
        <MapLayerToggle baseLayer={mapBaseLayer} onChange={onMapBaseLayerChange} />
        <div className="replay-map-modes">
          <button
            type="button"
            className={showPlannedRoute ? 'active' : ''}
            disabled={!hasPlannedRoute}
            aria-pressed={showPlannedRoute}
            title={hasPlannedRoute ? 'Afficher ou masquer la route prévue' : 'Route prévue non enregistrée pour cette trace'}
            onClick={() => setShowPlannedRoute((current) => !current)}
          >
            <i /> Route prévue
          </button>
          <button
            type="button"
            className={followAircraft ? 'active' : ''}
            aria-pressed={followAircraft}
            onClick={() => setFollowAircraft((current) => !current)}
          >
            {followAircraft ? 'Suivi avion' : 'Vue globale'}
          </button>
        </div>
        <ReplayMap
          model={model}
          aircraft={replay.sample?.position ?? null}
          plannedRoute={trace.plannedRoute}
          showPlannedRoute={showPlannedRoute}
          baseLayer={mapBaseLayer}
          followAircraft={followAircraft}
        />
        {crossTrack && (
          <div className="replay-cross-track-map">
            <span>Écart route</span>
            <strong>{crossTrack.distanceNm.toFixed(1).replace('.', ',')} NM</strong>
            <small>{crossTrack.side === 'gauche' ? 'à gauche' : crossTrack.side === 'droite' ? 'à droite' : 'sur la route'}</small>
          </div>
        )}
        {model.temporalAvailable ? (
          <ReplayPlaybackOverlay
            activeTimeMs={replay.activeTimeMs}
            totalTimeMs={model.totalActiveTimeMs}
            playing={replay.playing}
            onTogglePlayback={replay.togglePlayback}
            onRestart={replay.restart}
          />
        ) : (
          <div className="replay-no-time-notice">Lecture temporelle indisponible · déplacez le curseur du profil</div>
        )}
        {replay.gapNoticeMs !== null && model.temporalAvailable && (
          <div className="replay-gap-notice">Coupure GPS · {formatGap(replay.gapNoticeMs)} ignorée</div>
        )}
      </div>

      <AltitudeProfile model={model} sample={replay.sample} onSeekDistance={replay.seekDistance} />

      <div className="replay-speed-area">
        {model.temporalAvailable ? (
          <ReplaySpeedControls speed={replay.speed} onSpeedChange={replay.changeSpeed} />
        ) : (
          <p className="replay-data-warning">Ce GPX ne contient pas un horodatage complet et croissant. La carte et le profil restent consultables sans chronologie inventée.</p>
        )}
        {model.discardedPointCount > 0 && <p className="replay-data-warning">{model.discardedPointCount} point(s) invalide(s) ignoré(s).</p>}
      </div>
    </section>
  );
}
