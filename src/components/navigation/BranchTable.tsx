import type { NavRoute } from '../../domain/navigation.types';
import { formatMagneticVariation } from '../../services/geo/magneticVariation';

interface BranchTableProps {
  route: NavRoute;
}

function pointName(route: NavRoute, id: string) {
  const point = route.points.find((item) => item.id === id);
  return point?.code ?? point?.nom ?? id.toUpperCase();
}

function minutesToClock(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

export function BranchTable({ route }: BranchTableProps) {
  return (
    <div className="branch-table" role="table" aria-label="Branches de navigation">
      <div className="branch-row head" role="row">
        <span>Branche</span>
        <span>Dist</span>
        <span>RV</span>
        <span>Var</span>
        <span>RM</span>
        <span>ETE</span>
      </div>
      {route.branches.map((branch) => (
        <div key={branch.id} className="branch-row" role="row">
          <span>{pointName(route, branch.from)} - {pointName(route, branch.to)}</span>
          <span>{branch.distanceNm.toFixed(1)}</span>
          <span>{String(branch.routeVraie).padStart(3, '0')}°</span>
          <span>{formatMagneticVariation(branch.magneticVariationDeg)}</span>
          <span>{String(branch.routeMagnetique).padStart(3, '0')}°</span>
          <span>{minutesToClock(branch.tempsBrancheMin)}</span>
        </div>
      ))}
    </div>
  );
}
