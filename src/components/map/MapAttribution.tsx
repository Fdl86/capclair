import type { MapSourceStatus } from '../../mapEngine/mapTypes';

interface MapAttributionProps {
  sourceStatus: MapSourceStatus;
  showTopo?: boolean;
}

export function MapAttribution({ sourceStatus, showTopo = true }: MapAttributionProps) {
  const text = sourceStatus === 'free'
    ? `${showTopo ? 'Fond OpenStreetMap - données © contributeurs OpenStreetMap. ' : ''}Couche aviation © openAIP via proxy Cloudflare. Non officiel, non réglementaire.`
    : 'Fond demo local - aucune donnée officielle';

  return <div className="map-attribution">{text}</div>;
}
