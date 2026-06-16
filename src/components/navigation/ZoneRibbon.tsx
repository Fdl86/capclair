import { useState } from 'react';
import type { ZonePrototype } from '../../domain/zone.types';
import { ZoneDetailCard } from './ZoneDetailCard';

interface ZoneRibbonProps {
  zones: ZonePrototype[];
}

const statusLabel = {
  traversee: 'Traversée',
  proche: 'Proche',
  libre: 'Libre',
  a_verifier: 'À vérifier'
};

export function ZoneRibbon({ zones }: ZoneRibbonProps) {
  const [selectedZoneId, setSelectedZoneId] = useState(zones[1]?.id ?? zones[0]?.id);
  const selected = zones.find((zone) => zone.id === selectedZoneId) ?? null;

  return (
    <div className="zone-ribbon-block">
      <div className="zone-ribbon" aria-label="Zones traversées">
        {zones.map((zone) => (
          <button key={zone.id} type="button" className={`zone-card ${zone.statut} ${selectedZoneId === zone.id ? 'active' : ''}`} onClick={() => setSelectedZoneId(zone.id)}>
            <small>{zone.distanceRouteNm} NM</small>
            <strong>{zone.nom}</strong>
            <span>{zone.plancher} / {zone.plafond}</span>
            <em>{statusLabel[zone.statut]}</em>
          </button>
        ))}
      </div>
      {selected && <ZoneDetailCard zone={selected} />}
    </div>
  );
}
