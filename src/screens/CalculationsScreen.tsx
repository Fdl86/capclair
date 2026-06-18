import type { NavRoute } from '../domain/navigation.types';
import { Page } from '../components/layout/Page';
import { BranchTable } from '../components/navigation/BranchTable';
import { MetricCard } from '../components/cockpit/MetricCard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

interface CalculationsScreenProps {
  route: NavRoute;
  onValidate: () => void;
  onExport: () => void;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

export function CalculationsScreen({ route, onValidate, onExport }: CalculationsScreenProps) {
  const fuel = Math.round(route.tempsEstimeMin * 0.34);

  return (
    <Page title="Calculs de navigation" subtitle="Distances, routes vraies, variation estimée et routes magnétiques.">
      <div className="calculation-grid">
        <Card className="wide-card">
          <h2>Branches</h2>
          <BranchTable route={route} />
        </Card>

        <div className="metric-grid">
          <MetricCard label="Distance totale" value={`${route.distanceTotale.toFixed(1).replace('.', ',')} NM`} />
          <MetricCard label="Temps estimé" value={formatDuration(route.tempsEstimeMin)} />
          <MetricCard label="Carburant estimé" value={`${fuel},0 L`} />
        </div>

        <Card className="safety-card wide-card">
          <strong>Calculs préparatoires</strong>
          <p>La route magnétique utilise une variation estimée au milieu de chaque branche. Les valeurs restent à confirmer avec les documents de préparation réglementaires.</p>
        </Card>

        <div className="bottom-action-row">
          <Button variant="secondary" onClick={onExport}>Exporter</Button>
          <Button variant="primary" onClick={onValidate}>Valider le plan</Button>
        </div>
      </div>
    </Page>
  );
}
