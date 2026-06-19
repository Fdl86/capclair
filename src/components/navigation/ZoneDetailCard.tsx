import type { ZonePrototype } from '../../domain/zone.types';

interface ZoneDetailCardProps {
  zone: ZonePrototype;
}

const statusLabel = {
  traversee: 'Traversée',
  proche: 'Proche',
  libre: 'Libre',
  a_verifier: 'À vérifier'
};

export function ZoneDetailCard({ zone }: ZoneDetailCardProps) {
  return (
    <div className={`zone-detail ${zone.statut}`}>
      <div>
        <span>Zone</span>
        <strong>{zone.nom}</strong>
      </div>
      <p>{zone.type} - {zone.plancher} / {zone.plafond} - {statusLabel[zone.statut]}</p>
      <small>Vérification officielle nécessaire avant vol.</small>
    </div>
  );
}
