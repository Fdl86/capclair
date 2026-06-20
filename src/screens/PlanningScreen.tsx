import { useEffect, useMemo, useState } from 'react';
import type { AircraftProfile } from '../domain/aircraft.types';
import type { AerodromeWeather } from '../domain/weather.types';
import type { NavRoute } from '../domain/navigation.types';
import { AERODROMES, findAerodrome } from '../data/aerodromeCatalog';
import { Page } from '../components/layout/Page';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { OpenLayersMap } from '../components/map/OpenLayersMap';
import { MapLayerToggle } from '../components/map/MapLayerToggle';
import { RoutePointList } from '../components/navigation/RoutePointList';
import { AircraftProfilePanel } from '../components/flight/AircraftProfilePanel';
import { AerodromeWeatherPanel } from '../components/flight/AerodromeWeatherPanel';

interface PlanningScreenProps {
  route: NavRoute;
  selectedPointId: string | null;
  routeMessage: string;
  onSelectPoint: (pointId: string) => void;
  onSetDepartureCode: (code: string) => boolean;
  onSetDestinationCode: (code: string) => boolean;
  onAddWaypointAt: (longitude: number, latitude: number) => void;
  onRemovePoint: (pointId: string) => void;
  onReverseRoute: () => void;
  onSetTasKt: (tasKt: number) => void;
  onSetDefaultAltitudeFt: (altitudeFt: number) => void;
  onRefreshWinds: () => void;
  weatherStatus: string;
  alternateCode: string;
  onSetAlternateCode: (code: string) => void;
  aircraftProfiles: AircraftProfile[];
  activeAircraft: AircraftProfile;
  onSelectAircraft: (profileId: string) => void;
  onUpdateAircraft: (profileId: string, patch: Partial<AircraftProfile>) => void;
  onCreateAircraft: () => void;
  aerodromeWeatherReports: Record<string, AerodromeWeather>;
  aerodromeWeatherStatus: string;
  aerodromeWeatherUpdatedAt: string | null;
  onRefreshAerodromeWeather: () => void;
  onCalculations: () => void;
}

function endpointCode(route: NavRoute, type: 'depart' | 'destination') {
  return route.points.find((point) => point.type === type)?.code ?? '';
}

function aerodromeName(code: string) {
  return findAerodrome(code)?.cartoName;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}


export function PlanningScreen({
  route,
  selectedPointId,
  routeMessage,
  onSelectPoint,
  onSetDepartureCode,
  onSetDestinationCode,
  onAddWaypointAt,
  onRemovePoint,
  onReverseRoute,
  onSetTasKt,
  onSetDefaultAltitudeFt,
  onRefreshWinds,
  weatherStatus,
  alternateCode,
  onSetAlternateCode,
  aircraftProfiles,
  activeAircraft,
  onSelectAircraft,
  onUpdateAircraft,
  onCreateAircraft,
  aerodromeWeatherReports,
  aerodromeWeatherStatus,
  aerodromeWeatherUpdatedAt,
  onRefreshAerodromeWeather,
  onCalculations
}: PlanningScreenProps) {
  const [showTopo, setShowTopo] = useState(true);
  const [addWaypointMode, setAddWaypointMode] = useState(false);
  const [departureInput, setDepartureInput] = useState(endpointCode(route, 'depart'));
  const [destinationInput, setDestinationInput] = useState(endpointCode(route, 'destination'));
  const [alternateInput, setAlternateInput] = useState(alternateCode);

  useEffect(() => {
    setDepartureInput(endpointCode(route, 'depart'));
    setDestinationInput(endpointCode(route, 'destination'));
  }, [route.points]);

  useEffect(() => {
    setAlternateInput(alternateCode);
  }, [alternateCode]);

  const datalistId = useMemo(() => 'cap-clair-aerodromes', []);

  const applyDeparture = () => {
    if (departureInput.trim().length >= 4) onSetDepartureCode(departureInput);
  };

  const applyDestination = () => {
    if (destinationInput.trim().length >= 4) onSetDestinationCode(destinationInput);
  };

  const applyAlternate = () => {
    if (alternateInput.trim().length >= 4) onSetAlternateCode(alternateInput.trim().toUpperCase());
  };

  const handleAddWaypoint = (longitude: number, latitude: number) => {
    onAddWaypointAt(longitude, latitude);
    setAddWaypointMode(false);
  };

  return (
    <Page title="Planification" subtitle="Carte aéro, route modifiable, profil de vol et vent instantané par branche.">
      <div className="planning-layout">
        <div className="map-card tall planning-map-card">
          <MapLayerToggle showTopo={showTopo} onChange={setShowTopo} />
          <OpenLayersMap
            route={route}
            trace={[]}
            aircraft={null}
            selectedPointId={selectedPointId}
            showTopo={showTopo}
            addWaypointMode={addWaypointMode}
            onMapAddWaypoint={handleAddWaypoint}
          />
        </div>

        <Card className="route-panel compact-route-panel">
          <div className="panel-title-row">
            <div>
              <span>Route active</span>
              <strong>{route.nom}</strong>
            </div>
            <button type="button" onClick={onCalculations}>Log de nav</button>
          </div>

          <div className="route-builder">
            <label>
              <span>Départ</span>
              <input
                value={departureInput}
                onChange={(event) => setDepartureInput(event.target.value.toUpperCase())}
                onBlur={applyDeparture}
                onKeyDown={(event) => { if (event.key === 'Enter') applyDeparture(); }}
                maxLength={4}
                list={datalistId}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>
            <label>
              <span>Arrivée</span>
              <input
                value={destinationInput}
                onChange={(event) => setDestinationInput(event.target.value.toUpperCase())}
                onBlur={applyDestination}
                onKeyDown={(event) => { if (event.key === 'Enter') applyDestination(); }}
                maxLength={4}
                list={datalistId}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>
            <label>
              <span>Dégagement</span>
              <input
                value={alternateInput}
                onChange={(event) => setAlternateInput(event.target.value.toUpperCase())}
                onBlur={applyAlternate}
                onKeyDown={(event) => { if (event.key === 'Enter') applyAlternate(); }}
                maxLength={4}
                list={datalistId}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>
            <Button variant="ghost" className="route-builder-reverse" onClick={onReverseRoute}>Inverser</Button>
            <datalist id={datalistId}>
              {AERODROMES.map((aerodrome) => (
                <option key={aerodrome.code} value={aerodrome.code}>{aerodrome.cartoName}</option>
              ))}
            </datalist>
          </div>

          <div className="flight-profile-panel flight-profile-panel-compact cockpit-stepper-grid">
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

          <div className="weather-action-row">
            <span>{weatherStatus}</span>
            <Button variant="secondary" onClick={onRefreshWinds}>Maj vent</Button>
          </div>

          <div className="route-summary-line">
            <strong>{route.distanceTotale.toFixed(1).replace('.', ',')} NM</strong>
            <span>{formatDuration(route.tempsEstimeMin)}</span>
            <span>{route.vitesseSolKt} kt</span>
          </div>

          <AircraftProfilePanel
            profiles={aircraftProfiles}
            activeProfile={activeAircraft}
            onSelectProfile={onSelectAircraft}
            onUpdateProfile={onUpdateAircraft}
            onCreateProfile={onCreateAircraft}
          />

          <AerodromeWeatherPanel
            items={[
              { role: 'Départ', code: endpointCode(route, 'depart'), name: aerodromeName(endpointCode(route, 'depart')) },
              { role: 'Arrivée', code: endpointCode(route, 'destination'), name: aerodromeName(endpointCode(route, 'destination')) },
              { role: 'Dégagement', code: alternateCode, name: aerodromeName(alternateCode) }
            ]}
            reports={aerodromeWeatherReports}
            status={aerodromeWeatherStatus}
            updatedAtIso={aerodromeWeatherUpdatedAt}
            onRefresh={onRefreshAerodromeWeather}
          />

          <RoutePointList points={route.points} selectedPointId={selectedPointId} onSelect={onSelectPoint} onRemove={onRemovePoint} />

          <div className="route-hint">{routeMessage}</div>

          <div className="route-actions-row route-actions-row-single">
            <Button variant={addWaypointMode ? 'danger' : 'primary'} onClick={() => setAddWaypointMode((value) => !value)}>
              {addWaypointMode ? 'Annuler' : '+ Point'}
            </Button>
          </div>
        </Card>
      </div>
    </Page>
  );
}
