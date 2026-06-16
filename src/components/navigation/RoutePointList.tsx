import type { NavPoint } from '../../domain/navigation.types';
import { Button } from '../ui/Button';

interface RoutePointListProps {
  points: NavPoint[];
  selectedPointId: string | null;
  onSelect: (pointId: string) => void;
  onRemove: (pointId: string) => void;
}

export function RoutePointList({ points, selectedPointId, onSelect, onRemove }: RoutePointListProps) {
  return (
    <div className="route-point-list">
      {points.map((point, index) => (
        <div key={point.id} className={`route-point ${selectedPointId === point.id ? 'active' : ''}`} onClick={() => onSelect(point.id)} role="button" tabIndex={0}>
          <span className="point-chip">{point.type === 'depart' ? 'D' : point.type === 'destination' ? 'A' : index}</span>
          <div>
            <strong>{point.nom}</strong>
            <small>{point.type === 'depart' ? 'Départ' : point.type === 'destination' ? 'Destination' : 'Point tournant'}</small>
          </div>
          {point.type === 'waypoint' && <Button variant="ghost" onClick={(event) => { event.stopPropagation(); onRemove(point.id); }}>Supprimer</Button>}
        </div>
      ))}
    </div>
  );
}
