import type { NavRoute } from '../../domain/navigation.types';

interface BranchTableProps {
  route: NavRoute;
}

function pointName(route: NavRoute, id: string) {
  return route.points.find((point) => point.id === id)?.nom ?? id.toUpperCase();
}

export function BranchTable({ route }: BranchTableProps) {
  return (
    <div className="branch-table" role="table" aria-label="Branches de navigation">
      <div className="branch-row head" role="row">
        <span>Branche</span>
        <span>Dist</span>
        <span>Route</span>
        <span>Dérive</span>
        <span>Cap</span>
        <span>GS</span>
        <span>Temps</span>
      </div>
      {route.branches.map((branch) => (
        <div key={branch.id} className="branch-row" role="row">
          <span>{pointName(route, branch.from)} → {pointName(route, branch.to)}</span>
          <span>{branch.distanceNm.toFixed(1)}</span>
          <span>{String(branch.routeVraie).padStart(3, '0')}°</span>
          <span>{branch.derive > 0 ? '+' : ''}{branch.derive}°</span>
          <span>{String(branch.capCorrige).padStart(3, '0')}°</span>
          <span>{branch.vitesseSol}</span>
          <span>0:{String(branch.tempsBrancheMin).padStart(2, '0')}</span>
        </div>
      ))}
    </div>
  );
}
