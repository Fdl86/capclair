import type { MapBaseLayer } from '../../mapEngine/mapTypes';

interface MapLayerToggleProps {
  baseLayer: MapBaseLayer;
  onChange: (value: MapBaseLayer) => void;
  showSupAip?: boolean;
  onToggleSupAip?: () => void;
}

export function MapLayerToggle({ baseLayer, onChange, showSupAip = false, onToggleSupAip }: MapLayerToggleProps) {
  return (
    <div className="map-layer-toggle map-layer-toggle-wide" aria-label="Fond de carte et surimpressions">
      <span>Carte</span>
      <button type="button" className={baseLayer === 'free' ? 'active' : ''} onClick={() => onChange('free')}>
        openAIP
      </button>
      <button type="button" className={baseLayer === 'oaci' ? 'active' : ''} onClick={() => onChange('oaci')}>
        OACI <b>1/500k</b>
      </button>
      {onToggleSupAip && (
        <button
          type="button"
          className={`map-overlay-toggle ${showSupAip ? 'active' : ''}`}
          onClick={onToggleSupAip}
          aria-pressed={showSupAip}
          title="Afficher la couche expérimentale SUP AIP"
        >
          SUP AIP <small>BETA</small>
        </button>
      )}
    </div>
  );
}
