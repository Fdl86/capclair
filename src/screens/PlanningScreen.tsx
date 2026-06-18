import { useEffect, useMemo, useState } from 'react';
import type { NavRoute } from '../domain/navigation.types';
import { AERODROMES } from '../data/aerodromeCatalog';
import { Page } from '../components/layout/Page';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { OpenLayersMap } from '../components/map/OpenLayersMap';
import { MapLayerToggle } from '../components/map/MapLayerToggle';
import { RoutePointList } from '../components/navigation/RoutePointList';

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
  onSetDepartureTimeIso: (timeIso: string) => void;
  onRefreshWinds: () => void;
  weatherStatus: string;
  onCalculations: () => void;
  onZones: () => void;
}

function endpointCode(route: NavRoute, type: 'depart' | 'destination') {
  return route.points.find((point) => point.type === type)?.code ?? '';
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

function toUtcTimeInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '12:00';
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function fromUtcTimeInput(value: string, currentIso: string) {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date(currentIso);
  if (Number.isNaN(date.getTime()) || !Number.isFinite(hours) || !Number.isFinite(minutes)) return new Date().toISOString();
  date.setUTCHours(hours, minutes, 0, 0);
  return date.toISOString();
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
  onSetDepartureTimeIso,
  onRefreshWinds,
  weatherStatus,
  onCalculations,
  onZones
}: PlanningScreenProps) {
  const [showTopo, setShowTopo] = useState(true);
  const [addWaypointMode, setAddWaypointMode] = useState(false);
  const [departureInput, setDepartureInput] = useState(endpointCode(route, 'depart'));
  const [destinationInput, setDestinationInput] = useState(endpointCode(route, 'destination'));

  useEffect(() => {
    setDepartureInput(endpointCode(route, 'depart'));
    setDestinationInput(endpointCode(route, 'destination'));
  }, [route.points]);

  const datalistId = useMemo(() => 'cap-clair-aerodromes', []);

  const applyDeparture = () => {
    if (departureInput.trim().length >= 4) onSetDepartureCode(departureInput);
  };

  const applyDestination = () => {
    if (destinationInput.trim().length >= 4) onSetDestinationCode(destinationInput);
  };

  const handleAddWaypoint = (longitude: number, latitude: number) => {
    onAddWaypointAt(longitude, latitude);
    setAddWaypointMode(false);
  };

  return (
    <Page title="Planification" subtitle="Carte aéro, route modifiable, profil de vol et vent par branche.">
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
            <Button variant="ghost" className="route-builder-reverse" onClick={onReverseRoute}>Inverser</Button>
            <datalist id={datalistId}>
              {AERODROMES.map((aerodrome) => (
                <option key={aerodrome.code} value={aerodrome.code}>{aerodrome.cartoName}</option>
              ))}
            </datalist>
          </div>

          <div className="flight-profile-panel">
            <label>
              <span>TAS</span>
              <input
                type="number"
                min={45}
                max={220}
                step={5}
                value={route.profile.tasKt}
                onChange={(event) => onSetTasKt(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Alt défaut</span>
              <input
                type="number"
                min={500}
                max={12500}
                step={500}
                value={route.profile.defaultAltitudeFt}
                onChange={(event) => onSetDefaultAltitudeFt(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Départ UTC</span>
              <input
                type="time"
                value={toUtcTimeInput(route.profile.departureTimeIso)}
                onChange={(event) => onSetDepartureTimeIso(fromUtcTimeInput(event.target.value, route.profile.departureTimeIso))}
              />
            </label>
          </div>

          <div className="weather-action-row">
            <span>{weatherStatus}</span>
            <Button variant="secondary" onClick={onRefreshWinds}>Mettre à jour vent</Button>
          </div>

          <div className="route-summary-line">
            <strong>{route.distanceTotale.toFixed(1).replace('.', ',')} NM</strong>
            <span>{formatDuration(route.tempsEstimeMin)}</span>
            <span>{route.vitesseSolKt} kt</span>
          </div>

          <RoutePointList points={route.points} selectedPointId={selectedPointId} onSelect={onSelectPoint} onRemove={onRemovePoint} />

          <div className="route-hint">{routeMessage}</div>

          <div className="route-actions-row">
            <Button variant="secondary" onClick={onZones}>Zones</Button>
            <Button variant={addWaypointMode ? 'danger' : 'primary'} onClick={() => setAddWaypointMode((value) => !value)}>
              {addWaypointMode ? 'Annuler' : '+ Point'}
            </Button>
          </div>
        </Card>
      </div>
    </Page>
  );
}
