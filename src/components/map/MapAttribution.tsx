interface MapAttributionProps {
  official: boolean;
}

export function MapAttribution({ official }: MapAttributionProps) {
  return (
    <div className="map-attribution">
      {official ? 'SCAN OACI IGN / SIA via Géoplateforme - accès selon conditions' : 'Fond demo local - aucune donnée officielle'}
    </div>
  );
}
