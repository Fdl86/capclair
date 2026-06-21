interface MapLayerToggleProps {
  showTopo: boolean;
  onChange: (value: boolean) => void;
}

export function MapLayerToggle({ showTopo, onChange }: MapLayerToggleProps) {
  return (
    <div className="map-layer-toggle" aria-label="Options carte">
      <span>Carte aéro</span>
      <button type="button" role="switch" aria-checked={showTopo} className={showTopo ? 'active' : ''} onClick={() => onChange(!showTopo)}>
        Fond topo {showTopo ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
