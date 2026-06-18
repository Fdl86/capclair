import type { MapSourceStatus } from '../../mapEngine/mapTypes';
import type { MapMode } from './MapScaleSelector';

interface MapAttributionProps {
  sourceStatus: MapSourceStatus;
  mapMode?: MapMode;
}

export function MapAttribution({ sourceStatus, mapMode = 'aero' }: MapAttributionProps) {
  const modeText = mapMode === 'aero'
    ? 'Surcouche aviation openAIP via proxy Cloudflare.'
    : mapMode === 'free'
      ? 'Fond libre seul, sans surcouche aviation active.'
      : 'Données SIA XML prévues en surcouche France.';

  const text = sourceStatus === 'free'
    ? `Fond OpenStreetMap - données © contributeurs OpenStreetMap. ${modeText} Non officiel, non réglementaire.`
    : sourceStatus === 'sia-dev'
      ? 'Source SIA - OACI 1/500 000 Nord-Ouest 2026 - retuilage CAP CLAIR DEV - non officiel, non réglementaire'
      : sourceStatus === 'oaci'
        ? 'SCAN OACI IGN / SIA via Géoplateforme - accès selon conditions'
        : 'Fond demo local - aucune donnée officielle';

  return <div className="map-attribution">{text}</div>;
}
