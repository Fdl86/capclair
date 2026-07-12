import { useEffect, useMemo, useState } from 'react';
import type { BranchZoneProfile } from '../domain/airspace.types';
import type { AircraftProfile, FuelPlanConfig } from '../domain/aircraft.types';
import type { AerodromeWeather } from '../domain/weather.types';
import type { NavPoint, NavRoute } from '../domain/navigation.types';
import { Page } from '../components/layout/Page';
import { BranchTable } from '../components/navigation/BranchTable';
import { ZoneCompleteRouteBanner } from '../components/navigation/ZoneCompleteRouteBanner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Accordion } from '../components/ui/Accordion';
import { EmptyState } from '../components/ui/EmptyState';
import { buildZoneProfiles } from '../services/airspace/airspaceEngine';
import { computeFuelPlan } from '../services/navigation/fuelPlanning';
import { fetchTerrainProfile, type TerrainSample } from '../services/navigation/terrainService';
import { buildVerticalProfile } from '../services/navigation/verticalProfileService';
import { AircraftSelectorPanel } from '../components/flight/AircraftSelectorPanel';
import { AerodromeWeatherPanel } from '../components/flight/AerodromeWeatherPanel';
import { FuelPlanningPanel } from '../components/flight/FuelPlanningPanel';
import { findAerodrome } from '../data/aerodromeCatalog';
import { distanceNm } from '../services/geo/distance';
import { isRouteReady, routeMissingMessage } from '../services/navigation/routeValidation';
import { AIRCRAFT_LIMITS } from '../services/aircraft/aircraftValidation';

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
  fuelPlanConfig: FuelPlanConfig;
  onSetFuelPlanConfig: (patch: Partial<FuelPlanConfig>) => void;
  alternateCode: string;
  aerodromeWeatherReports: Record<string, AerodromeWeather>;
  aerodromeWeatherStatus: string;
  aerodromeWeatherUpdatedAt: string | null;
  onRefreshAerodromeWeather: () => void;
  onValidate: () => void;
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

function diversionMinutes(destinationCode: string | undefined, alternateCode: string, tasKt: number) {
  const destination = destinationCode ? findAerodrome(destinationCode) : null;
  const alternate = findAerodrome(alternateCode);
  if (!destination || !alternate || tasKt <= 0) return 0;
  return Math.round((distanceNm(destination, alternate) / tasKt) * 60);
}

function geometrySignature(route: NavRoute) {
  return route.points
    .map((point) => `${point.id}:${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`)
    .join('>');
}

function airspaceSignature(route: NavRoute) {
  return route.branches
    .map((branch) => `${branch.id}:${branch.altitudeFt}`)
    .join('|');
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
  fuelPlanConfig,
  onSetFuelPlanConfig,
  alternateCode,
  aerodromeWeatherReports,
  aerodromeWeatherStatus,
  aerodromeWeatherUpdatedAt,
  onRefreshAerodromeWeather,
  onValidate,
  onBackPlanning
}: CalculationsScreenProps) {
  const departure = pointByType(route, 'depart');
  const destination = pointByType(route, 'destination');
  const ready = isRouteReady(route);
  const windModelTime = route.branches.find((branch) => branch.wind?.sourceTimeIso)?.wind?.sourceTimeIso;
  const [zoneProfiles, setZoneProfiles] = useState<Record<string, BranchZoneProfile>>({});
  const [zoneStatus, setZoneStatus] = useState('Calcul zones...');
  const [terrain, setTerrain] = useState<TerrainSample[]>([]);
  const [shownZoneCount, setShownZoneCount] = useState(0);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const routeGeometryKey = useMemo(() => geometrySignature(route), [route.points]);
  const routeAirspaceKey = useMemo(() => airspaceSignature(route), [route.branches]);

  useEffect(() => {
    if (!ready) {
      setTerrain([]);
      return undefined;
    }

    let cancelled = false;
    fetchTerrainProfile(route)
      .then((samples) => {
        if (!cancelled) setTerrain(samples);
      })
      .catch(() => {
        if (!cancelled) setTerrain([]);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, routeGeometryKey]);

  useEffect(() => {
    if (!ready) {
      setZoneProfiles({});
      setZoneStatus('Route incomplète');
      setShownZoneCount(0);
      return undefined;
    }

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
  }, [ready, routeGeometryKey, routeAirspaceKey]);

  const verticalProfile = useMemo(
    () => ready ? buildVerticalProfile(route, activeAircraft) : [],
    [ready, routeGeometryKey, routeAirspaceKey, activeAircraft.climbRateFpm, activeAircraft.climbSpeedKt, activeAircraft.descentRateFpm, activeAircraft.descentSpeedKt]
  );
  const fuel = useMemo(
    () => computeFuelPlan(
      route,
      activeAircraft,
      fuelPlanConfig,
      diversionMinutes(destination?.code, alternateCode, route.profile.tasKt || activeAircraft.cruiseTasKt)
    ),
    [route, activeAircraft, fuelPlanConfig, destination?.code, alternateCode]
  );

  if (!ready) {
    return (
      <Page title="Log de nav" subtitle="Préparation VFR - calculs, vent et frise zones complète.">
        <div className="navlog-empty-state">
          <EmptyState title="Navigation incomplète" text={routeMissingMessage(route)} />
          <Button variant="primary" onClick={onBackPlanning}>Retour à la planification</Button>
        </div>
      </Page>
    );
  }

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
          <SummaryCard label="Emport carburant" value={`${fuel.lines.fuelRequired.liters.toFixed(0)} L`} detail={`Total nécessaire ${fuel.lines.totalNecessary.minutes} min`} />
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
                  <button
                    type="button"
                    disabled={route.profile.tasKt <= AIRCRAFT_LIMITS.cruiseTasKt.min}
                    onClick={() => onSetTasKt(route.profile.tasKt - 1)}
                    aria-label="Réduire la TAS"
                  >-</button>
                  <strong>{route.profile.tasKt}</strong>
                  <button
                    type="button"
                    disabled={route.profile.tasKt >= AIRCRAFT_LIMITS.cruiseTasKt.max}
                    onClick={() => onSetTasKt(route.profile.tasKt + 1)}
                    aria-label="Augmenter la TAS"
                  >+</button>
                </div>
              </div>
              <div className="cockpit-stepper">
                <span>Alt défaut</span>
                <div>
                  <button type="button" disabled={route.profile.defaultAltitudeFt <= 500} onClick={() => onSetDefaultAltitudeFt(route.profile.defaultAltitudeFt - 100)} aria-label="Réduire l'altitude">-</button>
                  <strong>{route.profile.defaultAltitudeFt}</strong>
                  <button type="button" disabled={route.profile.defaultAltitudeFt >= 12500} onClick={() => onSetDefaultAltitudeFt(route.profile.defaultAltitudeFt + 100)} aria-label="Augmenter l'altitude">+</button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Accordion title="Devis carburant" className="fuel-card" defaultOpen storageKey="capclair.accordion.navlog.fuel.v1">
          <FuelPlanningPanel fuel={fuel} config={fuelPlanConfig} onChangeConfig={onSetFuelPlanConfig} />
        </Accordion>

        <Accordion
          title="Tableau de navigation"
          subtitle={route.nom}
          className="navlog-card"
          action={<Button variant="secondary" onClick={onRefreshWinds}>Maj vent</Button>}
          defaultOpen
          storageKey="capclair.accordion.navlog.table.v1"
        >
          <div className="navlog-table-scroll">
            <BranchTable route={route} zoneProfiles={zoneProfiles} onSetBranchAltitude={onSetBranchAltitude} />
          </div>
        </Accordion>

        <Accordion
          title="Frise zones"
          subtitle={shownZoneCount ? `${shownZoneCount} zones sur la nav` : zoneStatus}
          className="zone-banner-card"
          action={<Button variant="secondary" onClick={onBackPlanning}>Modifier route</Button>}
          defaultOpen
          storageKey="capclair.accordion.navlog.zones.v1"
        >
          {Object.keys(zoneProfiles).length ? (
            <ZoneCompleteRouteBanner
              route={route}
              profiles={zoneProfiles}
              terrain={terrain}
              profile={verticalProfile}
              onVisibleCountChange={setShownZoneCount}
            />
          ) : (
            <div className="zone-banner-loading">{zoneStatus}</div>
          )}
        </Accordion>

        <div className="navlog-bottom-grid navlog-bottom-grid-wide">
          <Accordion title="Météo terrains" className="navlog-weather-card" defaultOpen storageKey="capclair.accordion.navlog.weather.v1">
            <AerodromeWeatherPanel
              items={[
                ...(departure?.code ? [{ role: 'Départ', code: departure.code, name: aerodromeName(departure.code) }] : []),
                ...(destination?.code ? [{ role: 'Arrivée', code: destination.code, name: aerodromeName(destination.code) }] : []),
                ...(alternateCode ? [{ role: 'Dégagement', code: alternateCode, name: aerodromeName(alternateCode) }] : [])
              ]}
              reports={aerodromeWeatherReports}
              status={aerodromeWeatherStatus}
              updatedAtIso={aerodromeWeatherUpdatedAt}
              onRefresh={onRefreshAerodromeWeather}
            />
          </Accordion>
        </div>

        <div className="navlog-actions">
          <Button variant="secondary" onClick={onBackPlanning}>Retour planification</Button>
          <div>
            <Button
              variant="secondary"
              onClick={() => setPdfStatus('Export PDF conservé pour la prochaine étape. Le module dédié sera ajouté ensuite.')}
            >Exporter PDF</Button>
            <Button variant="primary" onClick={onValidate}>Passer au suivi</Button>
          </div>
        </div>
        {pdfStatus && <p className="pdf-export-status" role="status">{pdfStatus}</p>}

        <Card className="safety-card">
          <strong>Info frise</strong>
          <p>Les zones sont calculées par position et altitude de branche. Les fréquences sont affichées seulement lorsqu'une fréquence exploitable est liée à la zone ; sinon le log indique à confirmer.</p>
        </Card>
      </div>
    </Page>
  );
}
