import { useEffect, useState } from 'react';
import type { BranchZoneProfile } from '../domain/airspace.types';
import type { AircraftProfile } from '../domain/aircraft.types';
import type { AerodromeWeather } from '../domain/weather.types';
import type { NavPoint, NavRoute } from '../domain/navigation.types';
import { Page } from '../components/layout/Page';
import { BranchTable } from '../components/navigation/BranchTable';
import { ZoneCompleteRouteBanner } from '../components/navigation/ZoneCompleteRouteBanner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { buildZoneProfiles } from '../services/airspace/airspaceEngine';
import { computeFuelSummary } from '../services/navigation/fuelPlanning';
import { AircraftSelectorPanel } from '../components/flight/AircraftSelectorPanel';
import { AerodromeWeatherPanel } from '../components/flight/AerodromeWeatherPanel';
import { findAerodrome } from '../data/aerodromeCatalog';

interface CalculationsScreenProps {
  route: NavRoute;
  weatherStatus: string;
  onSetBranchAltitude: (branchId: string, altitudeFt: number) => void;
  onRefreshWinds: () => void;
  onSetTasKt: (tasKt: number) => void;
  onSetDefaultAltitudeFt: (altitudeFt: number) => void;
  aircraftProfiles: AircraftProfile[];
  activeAircraft: AircraftProfile;
  onSelectAircraft: (profileId: string) => void;
  alternateCode: string;
  aerodromeWeatherReports: Record<string, AerodromeWeather>;
  aerodromeWeatherStatus: string;
  aerodromeWeatherUpdatedAt: string | null;
  onRefreshAerodromeWeather: () => void;
  onValidate: () => void;
  onExport: () => void;
  onBackPlanning: () => void;
}

function pointByType(route: NavRoute, type: NavPoint['type']) {
  return route.points.find((point) => point.type === type);
}

function aerodromeName(code: string) {
  return findAerodrome(code)?.cartoName;
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
  onSetTasKt,
  onSetDefaultAltitudeFt,
  aircraftProfiles,
  activeAircraft,
  onSelectAircraft,
  alternateCode,
  aerodromeWeatherReports,
  aerodromeWeatherStatus,
  aerodromeWeatherUpdatedAt,
  onRefreshAerodromeWeather,
  onValidate,
  onExport,
  onBackPlanning
}: CalculationsScreenProps) {
  const departure = pointByType(route, 'depart');
  const destination = pointByType(route, 'destination');
  const windModelTime = route.branches.find((branch) => branch.wind?.sourceTimeIso)?.wind?.sourceTimeIso;
  const [zoneProfiles, setZoneProfiles] = useState<Record<string, BranchZoneProfile>>({});
  const [zoneStatus, setZoneStatus] = useState('Calcul zones...');

  useEffect(() => {
    let cancelled = false;
    setZoneStatus('Calcul zones...');
    buildZoneProfiles(route)
      .then((profiles) => {
        if (cancelled) return;
        setZoneProfiles(profiles);
        setZoneStatus('Zones calculées');
      })
      .catch(() => {
        if (cancelled) return;
        setZoneProfiles({});
        setZoneStatus('Zones à confirmer');
      });

    return () => {
      cancelled = true;
    };
  }, [route]);

  const activeZoneCount = Object.values(zoneProfiles).reduce((sum, profile) => sum + profile.activeBlocks.length, 0);
  const fuel = computeFuelSummary(route, activeAircraft);

  return (
    <Page title="Log de nav" subtitle="Préparation VFR - calculs, vent et frise zones complète.">
      <div className="navlog-screen">
        <div className="navlog-summary-grid">
          <SummaryCard label="Départ" value={departure?.code ?? '----'} detail={departure?.nom} />
          <SummaryCard label="Arrivée" value={destination?.code ?? '----'} detail={destination?.nom} />
          <SummaryCard label="TAS" value={`${route.profile.tasKt} kt`} />
          <SummaryCard label="Altitude défaut" value={`${route.profile.defaultAltitudeFt} ft`} />
          <SummaryCard label="Distance totale" value={`${route.distanceTotale.toFixed(1)} NM`} />
          <SummaryCard label="Temps estimé" value={formatDuration(route.tempsEstimeMin)} />
          <SummaryCard label="Vent modèle" value={windModelTime ? timeZulu(windModelTime) : 'À charger'} detail={weatherStatus} />
          <SummaryCard label="Avion" value={activeAircraft.label} detail={`${activeAircraft.fuelBurnLh} L/h`} />
          <SummaryCard label="Carburant mini" value={`${fuel.totalFuelL.toFixed(1)} L`} detail={`Route ${fuel.routeFuelL.toFixed(1)} L + réserve`} />
        </div>

        <Card className="navlog-prep-card">
          <div className="navlog-prep-grid">
            <AircraftSelectorPanel
              profiles={aircraftProfiles}
              activeProfile={activeAircraft}
              onSelectProfile={onSelectAircraft}
            />
            <div className="cockpit-stepper-grid navlog-stepper-grid">
              <div className="cockpit-stepper">
                <span>TAS</span>
                <div>
                  <button type="button" onClick={() => onSetTasKt(route.profile.tasKt - 1)} aria-label="Réduire la TAS">-</button>
                  <strong>{route.profile.tasKt}</strong>
                  <button type="button" onClick={() => onSetTasKt(route.profile.tasKt + 1)} aria-label="Augmenter la TAS">+</button>
                </div>
              </div>
              <div className="cockpit-stepper">
                <span>Alt défaut</span>
                <div>
                  <button type="button" onClick={() => onSetDefaultAltitudeFt(route.profile.defaultAltitudeFt - 500)} aria-label="Réduire l'altitude">-</button>
                  <strong>{route.profile.defaultAltitudeFt}</strong>
                  <button type="button" onClick={() => onSetDefaultAltitudeFt(route.profile.defaultAltitudeFt + 500)} aria-label="Augmenter l'altitude">+</button>
                </div>
              </div>
            </div>
            <Button variant="secondary" onClick={onRefreshWinds}>Maj vent</Button>
          </div>
        </Card>

        <Card className="navlog-card">
          <div className="panel-title-row">
            <div>
              <span>Tableau de navigation</span>
              <strong>{route.nom}</strong>
            </div>
            <Button variant="secondary" onClick={onRefreshWinds}>Modifier vents</Button>
          </div>
          <BranchTable route={route} zoneProfiles={zoneProfiles} onSetBranchAltitude={onSetBranchAltitude} />
        </Card>

        <Card className="zone-banner-card">
          <div className="panel-title-row">
            <div>
              <span>Frise zones</span>
              <strong>{activeZoneCount ? `${activeZoneCount} zones actives sur la nav` : zoneStatus}</strong>
            </div>
            <Button variant="secondary" onClick={onBackPlanning}>Modifier route</Button>
          </div>
          {Object.keys(zoneProfiles).length ? (
            <ZoneCompleteRouteBanner route={route} profiles={zoneProfiles} />
          ) : (
            <div className="zone-banner-loading">{zoneStatus}</div>
          )}
        </Card>

        <div className="navlog-bottom-grid navlog-bottom-grid-wide">
          <Card className="navlog-zones-card">
            <h2>Règle d'affichage</h2>
            <div className="zone-rule-list">
              <span><b>Bloc plein</b> altitude de branche dans la zone</span>
              <span><b>Bloc atténué</b> zone traversée mais hors altitude</span>
              <span><b>À confirmer</b> limite verticale incertaine ou contact multiple</span>
            </div>
            <div className="fuel-mini-card">
              <strong>Carburant estimé</strong>
              <span>Route {fuel.routeFuelL.toFixed(1)} L</span>
              <span>Réserve {fuel.reserveFuelL.toFixed(1)} L</span>
              <span>Total mini {fuel.totalFuelL.toFixed(1)} L</span>
            </div>
          </Card>

          <Card className="navlog-weather-card">
            <AerodromeWeatherPanel
              items={[
                { role: 'Départ', code: departure?.code ?? '', name: aerodromeName(departure?.code ?? '') },
                { role: 'Arrivée', code: destination?.code ?? '', name: aerodromeName(destination?.code ?? '') },
                { role: 'Dégagement', code: alternateCode, name: aerodromeName(alternateCode) }
              ]}
              reports={aerodromeWeatherReports}
              status={aerodromeWeatherStatus}
              updatedAtIso={aerodromeWeatherUpdatedAt}
              onRefresh={onRefreshAerodromeWeather}
            />
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

        <Card className="safety-card">
          <strong>Info frise</strong>
          <p>Les zones sont calculées par position et altitude de branche. Les fréquences sont affichées seulement lorsqu'une fréquence exploitable est liée à la zone ; sinon le log indique à confirmer.</p>
        </Card>
      </div>
    </Page>
  );
}
