interface MapLayerToggleProps {
  showTopo: boolean;
  onChange: (value: boolean) => void;
}

export function MapLayerToggle({ showTopo, onChange }: MapLayerToggleProps) {
  return (
    <div className="map-layer-toggle" aria-label="Options carte">
      <button
        type="button"
        role="switch"
        aria-checked={showTopo}
        className={showTopo ? 'active' : ''}
        onClick={() => onChange(!showTopo)}
        title={showTopo ? 'Masquer le fond topographique' : 'Afficher le fond topographique'}
      >
        Fond topo
      </button>
    </div>
  );
}
