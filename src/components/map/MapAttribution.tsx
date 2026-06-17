import type { MapSourceStatus } from '../../mapEngine/mapTypes';

interface MapAttributionProps {
  sourceStatus: MapSourceStatus;
}

export function MapAttribution({ sourceStatus }: MapAttributionProps) {
  const text = sourceStatus === 'sia-dev'
    ? 'Source SIA - OACI 1/500 000 Nord-Ouest 2026 - retuilage CAP CLAIR DEV - non officiel, non réglementaire'
    : sourceStatus === 'oaci'
      ? 'SCAN OACI IGN / SIA via Géoplateforme - accès selon conditions'
      : 'Fond demo local - aucune donnée officielle';

  return <div className="map-attribution">{text}</div>;
}
