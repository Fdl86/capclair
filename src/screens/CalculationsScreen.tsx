import type { NavPoint, NavRoute } from '../domain/navigation.types';
import { Page } from '../components/layout/Page';
import { BranchTable } from '../components/navigation/BranchTable';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

interface CalculationsScreenProps {
  route: NavRoute;
  weatherStatus: string;
  onSetBranchAltitude: (branchId: string, altitudeFt: number) => void;
  onRefreshWinds: () => void;
  onValidate: () => void;
  onExport: () => void;
  onBackPlanning: () => void;
}

function pointByType(route: NavRoute, type: NavPoint['type']) {
  return route.points.find((point) => point.type === type);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

function timeZulu(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}Z`;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="navlog-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function CalculationsScreen({
  route,
  weatherStatus,
  onSetBranchAltitude,
  onRefreshWinds,
  onValidate,
  onExport,
  onBackPlanning
}: CalculationsScreenProps) {
  const departure = pointByType(route, 'depart');
  const destination = pointByType(route, 'destination');
  const lastBranch = route.branches[route.branches.length - 1];
  const windModelTime = route.branches.find((branch) => branch.wind?.sourceTimeIso)?.wind?.sourceTimeIso;

  return (
    <Page title="Log de nav" subtitle="Préparation VFR - calculs, vent et suivi de branche.">
      <div className="navlog-screen">
        <div className="navlog-summary-grid">
          <SummaryCard label="Départ" value={departure?.code ?? '----'} detail={departure?.nom} />
          <SummaryCard label="Arrivée" value={destination?.code ?? '----'} detail={destination?.nom} />
          <SummaryCard label="TAS" value={`${route.profile.tasKt} kt`} />
          <SummaryCard label="Altitude défaut" value={`${route.profile.defaultAltitudeFt} ft`} />
          <SummaryCard label="Distance totale" value={`${route.distanceTotale.toFixed(1)} NM`} />
          <SummaryCard label="Temps estimé" value={formatDuration(route.tempsEstimeMin)} />
          <SummaryCard label="Vent modèle" value={windModelTime ? timeZulu(windModelTime) : 'À charger'} detail={weatherStatus} />
        </div>

        <Card className="navlog-card">
          <div className="panel-title-row">
            <div>
              <span>Tableau de navigation</span>
              <strong>{route.nom}</strong>
            </div>
            <Button variant="secondary" onClick={onRefreshWinds}>Modifier vents</Button>
          </div>
          <BranchTable route={route} onSetBranchAltitude={onSetBranchAltitude} />
        </Card>

        <div className="navlog-bottom-grid">
          <Card className="navlog-zones-card">
            <h2>Zones traversées</h2>
            <div className="navlog-zone-chips">
              <span className="zone-chip blue">CTR TOURS <b>D</b><small>2500 ft AMSL</small></span>
              <span className="zone-chip amber">TMA TOURS 1 <b>D</b><small>2500 ft - FL065</small></span>
              <span className="zone-chip blue">TMA ANGERS <b>D</b><small>2500 ft - FL065</small></span>
              <span className="zone-chip green">SIV PARIS <b>C</b><small>SFC - FL115</small></span>
            </div>
          </Card>

          <Card className="navlog-notes-card">
            <h2>Notes pilote</h2>
            <div className="pilot-notes-box">
              <p>Navigation VFR. Surveiller les zones à statut particulier.</p>
              <p>Prévoir contournement ou contact radio selon trajectoire finale.</p>
              <small>Préparation non réglementaire</small>
            </div>
          </Card>
        </div>

        <div className="navlog-actions">
          <Button variant="secondary" onClick={onBackPlanning}>Retour planification</Button>
          <div>
            <Button variant="secondary" onClick={onExport}>Exporter PDF</Button>
            <Button variant="secondary" onClick={() => window.print()}>Imprimer</Button>
            <Button variant="primary" onClick={onValidate}>Enregistrer le log</Button>
          </div>
        </div>

        {lastBranch && (
          <Card className="safety-card">
            <strong>Info calcul</strong>
            <p>Les vents sont récupérés à l'instant où l'utilisateur lance la mise à jour, par échantillons optimisés sur les branches. Les routes magnétiques utilisent la variation affichée au format aviation, par exemple 1E ou 1W.</p>
          </Card>
        )}
      </div>
    </Page>
  );
}
