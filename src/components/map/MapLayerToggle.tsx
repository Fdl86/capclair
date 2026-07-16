import type { SupAipDisplayMode } from '../../domain/supaip.types';
import type { MapBaseLayer } from '../../mapEngine/mapTypes';

interface MapLayerToggleProps {
  baseLayer: MapBaseLayer;
  onChange: (value: MapBaseLayer) => void;
  supAipMode?: SupAipDisplayMode;
  onCycleSupAipMode?: () => void;
  notamAvailable?: boolean;
  notamEnabled?: boolean;
  onToggleNotam?: () => void;
}

const modeLabel: Record<SupAipDisplayMode, string> = {
  off: 'OFF',
  route: 'ROUTE',
  all: 'TOUS'
};

export function MapLayerToggle({ baseLayer, onChange, supAipMode = 'off', onCycleSupAipMode, notamAvailable = false, notamEnabled = false, onToggleNotam }: MapLayerToggleProps) {
  const supAipActive = supAipMode !== 'off';

  return (
    <div className="map-layer-toggle map-layer-toggle-wide" aria-label="Fond de carte et surimpressions">
      <span>Carte</span>
      <button type="button" className={baseLayer === 'free' ? 'active' : ''} onClick={() => onChange('free')}>
        openAIP
      </button>
      <button type="button" className={baseLayer === 'oaci' ? 'active' : ''} onClick={() => onChange('oaci')}>
        OACI <b>1/500k</b>
      </button>
      {onCycleSupAipMode && (
        <button
          type="button"
          className={`map-overlay-toggle mode-${supAipMode} ${supAipActive ? 'active' : ''}`}
          onClick={onCycleSupAipMode}
          aria-pressed={supAipActive}
          title={`SUP AIP BETA: ${modeLabel[supAipMode]}. Appuyer pour changer de mode.`}
        >
          SUP AIP <em>{modeLabel[supAipMode]}</em> <small>BETA</small>
        </button>
      )}
      {onToggleNotam && (
        <button
          type="button"
          className={`map-overlay-toggle notam-overlay-toggle ${notamEnabled ? 'active' : ''}`}
          onClick={onToggleNotam}
          aria-pressed={notamEnabled}
          disabled={!notamAvailable}
          title={notamAvailable ? 'Afficher ou masquer le dernier briefing NOTAM / PIB analysé.' : 'Importer d’abord un briefing dans Plus.'}
        >
          NOTAM <em>{notamEnabled ? 'ON' : 'OFF'}</em> <small>BETA</small>
        </button>
      )}
    </div>
  );
}
