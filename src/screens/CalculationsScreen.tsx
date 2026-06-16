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
    <Page title="Calculs de navigation" subtitle="Log structuré DEV01 avec valeurs mockées et calculs simplifiés.">
      <div className="calculation-grid">
        <Card className="wide-card">
          <h2>Branches</h2>
          <BranchTable route={route} />
        </Card>

        <div className="metric-grid">
          <MetricCard label="Distance totale" value={`${route.distanceTotale.toFixed(1).replace('.', ',')} NM`} />
          <MetricCard label="Temps total estimé" value={formatDuration(route.tempsEstimeMin)} />
          <MetricCard label="Carburant estimé" value={`${fuel},0 L`} />
        </div>

        <Card className="safety-card wide-card">
          <strong>Données DEV01</strong>
          <p>Les caps, dérives et consommations sont des données prototype. Aucune donnée météo réelle, NOTAM ou SIA n’est intégrée.</p>
        </Card>

        <div className="bottom-action-row">
          <Button variant="secondary" onClick={onExport}>Exporter</Button>
          <Button variant="primary" onClick={onValidate}>Valider le plan</Button>
        </div>
      </div>
    </Page>
  );
}
