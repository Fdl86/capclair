import type { BranchWindAuditLevel, NavBranch, NavPoint, NavRoute } from '../domain/navigation.types';
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

function pointName(route: NavRoute, id: string) {
  const point = route.points.find((item) => item.id === id);
  return point?.code ?? point?.nom ?? id.toUpperCase();
}

function branchName(route: NavRoute, branch: NavBranch) {
  return `${pointName(route, branch.from)} - ${pointName(route, branch.to)}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

function timeZulu(iso?: string) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}Z`;
}

function localTime(iso?: string) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function windText(directionDeg?: number, speedKt?: number) {
  if (typeof directionDeg !== 'number' || typeof speedKt !== 'number') return '-';
  return `${String(directionDeg).padStart(3, '0')}/${speedKt}`;
}

function levelText(level?: BranchWindAuditLevel | null) {
  if (!level) return '-';
  return `${level.pressureHpa} hPa - ${level.heightFt} ft - ${windText(level.directionDeg, level.speedKt)}`;
}

function modelLabel(provider?: string) {
  if (!provider) return '-';
  if (provider === 'mixed') return 'Mix modèles';
  if (provider.includes('meteofrance')) return 'Météo-France strict via Open-Meteo';
  if (provider.includes('forecast')) return 'Open-Meteo fallback';
  return provider;
}

function comparableWindy(branch: NavBranch) {
  if (!branch.wind) return 'non - vent absent';
  if (branch.wind.fallback) return 'non - fallback';
  if (!branch.wind.provider?.includes('meteofrance')) return 'non - source différente';
  return 'oui - même famille MF';
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

function WeatherAuditCard({ route, branch }: { route: NavRoute; branch: NavBranch }) {
  const audit = branch.wind?.auditSamples?.[0];
  const sampleCount = branch.wind?.auditSamples?.length ?? 0;

  return (
    <div className={`weather-audit-row ${branch.wind ? 'ok' : 'missing'}`}>
      <div className="weather-audit-main">
        <strong>{branchName(route, branch)}</strong>
        <span>{branch.wind ? `Vent ${windText(branch.wind.directionDeg, branch.wind.speedKt)}` : 'Vent non reçu'}</span>
      </div>

      {audit ? (
        <div className="weather-audit-grid">
          <span><b>Point</b>{audit.latitude.toFixed(1)} / {audit.longitude.toFixed(1)}</span>
          <span><b>Altitude</b>{audit.altitudeFt} ft</span>
          <span><b>Heure UTC</b>{timeZulu(audit.sourceTimeIso)}</span>
          <span><b>Heure locale</b>{localTime(audit.sourceTimeIso)}</span>
          <span><b>Régler Windy</b>{localTime(audit.sourceTimeIso)}</span>
          <span><b>Comparable Windy</b>{comparableWindy(branch)}</span>
          <span><b>Source</b>{modelLabel(branch.wind?.provider)}</span>
          <span><b>Endpoint</b>{branch.wind?.endpoint ?? audit.endpoint}</span>
          <span><b>Fallback</b>{branch.wind?.fallback ? 'oui' : 'non'}</span>
          <span><b>Cache</b>{branch.wind?.cache ?? audit.cache}</span>
          <span className="wide"><b>Niveau bas</b>{levelText(audit.lowerLevel)}</span>
          <span className="wide"><b>Niveau haut</b>{levelText(audit.upperLevel)}</span>
          <span><b>Samples</b>{sampleCount}</span>
          <span><b>Clé</b>{audit.normalizedKey}</span>
        </div>
      ) : (
        <p className="weather-audit-missing">Relancer Maj vent. En mode strict Météo-France, une branche sans vent n'est pas remplacée par un fallback afin de rester comparable avec Windy AROME.</p>
      )}
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
  const loadedWinds = route.branches.filter((branch) => branch.wind).length;

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

        <Card className="weather-audit-card">
          <div className="panel-title-row">
            <div>
              <span>Audit météo</span>
              <strong>{loadedWinds}/{route.branches.length} branches avec vent</strong>
            </div>
            <Button variant="secondary" onClick={onRefreshWinds}>Relancer audit</Button>
          </div>
          <div className="weather-audit-list">
            {route.branches.map((branch) => (
              <WeatherAuditCard key={branch.id} route={route} branch={branch} />
            ))}
          </div>
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
            <p>Les vents sont récupérés à l'instant où l'utilisateur lance la mise à jour, en mode Météo-France strict. Aucun fallback forecast n'est injecté, pour éviter les comparaisons faussées avec Windy AROME.</p>
          </Card>
        )}
      </div>
    </Page>
  );
}
