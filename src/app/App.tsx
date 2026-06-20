import { useState } from 'react';
import type { ScreenId } from './routes';
import { findAerodrome } from '../data/aerodromeCatalog';
import { AppShell } from '../components/layout/AppShell';
import { HomeScreen } from '../screens/HomeScreen';
import { PlanningScreen } from '../screens/PlanningScreen';
import { CalculationsScreen } from '../screens/CalculationsScreen';
import { ZonesScreen } from '../screens/ZonesScreen';
import { TrackingScreen } from '../screens/TrackingScreen';
import { TracesScreen } from '../screens/TracesScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { useActiveRoute } from '../hooks/useActiveRoute';
import { useTraces } from '../hooks/useTraces';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { useAircraftProfiles } from '../hooks/useAircraftProfiles';
import { useAerodromeWeather } from '../hooks/useAerodromeWeather';
import { DEFAULT_FUEL_PLAN_CONFIG } from '../domain/aircraft.types';

function routeEndpointCode(route: ReturnType<typeof useActiveRoute>['route'], type: 'depart' | 'destination') {
  return route.points.find((point) => point.type === type)?.code ?? '';
}

function safeAerodromeCode(code: string, fallback: string) {
  const normalized = code.trim().toUpperCase();
  return findAerodrome(normalized) ? normalized : fallback;
}

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const routeState = useActiveRoute();
  const traceState = useTraces();
  const aircraftState = useAircraftProfiles();
  const [alternateCode, setAlternateCode] = useLocalStorageState('capclair.alternateCode.v1', 'LFOO');
  const [fuelPlanConfigRaw, setFuelPlanConfig] = useLocalStorageState('capclair.fuelPlan.v1', DEFAULT_FUEL_PLAN_CONFIG);
  const fuelPlanConfig = { ...DEFAULT_FUEL_PLAN_CONFIG, ...fuelPlanConfigRaw };

  const departureCode = routeEndpointCode(routeState.route, 'depart');
  const destinationCode = routeEndpointCode(routeState.route, 'destination');
  const safeAlternateCode = safeAerodromeCode(alternateCode, 'LFOO');
  const aerodromeWeatherState = useAerodromeWeather([departureCode, destinationCode, safeAlternateCode]);

  const setAlternate = (code: string) => {
    setAlternateCode(safeAerodromeCode(code, safeAlternateCode));
  };

  const selectAircraft = (profileId: string) => {
    const selected = aircraftState.selectProfile(profileId);
    routeState.setTasKt(selected.cruiseTasKt);
  };

  const updateAircraft = (profileId: string, patch: Parameters<typeof aircraftState.updateProfile>[1]) => {
    aircraftState.updateProfile(profileId, patch);
    if (profileId === aircraftState.activeProfile.id && typeof patch.cruiseTasKt === 'number') {
      routeState.setTasKt(patch.cruiseTasKt);
    }
  };

  const createAircraft = () => {
    const profile = aircraftState.createProfile();
    routeState.setTasKt(profile.cruiseTasKt);
  };

  const updateFuelPlanConfig = (patch: Partial<typeof DEFAULT_FUEL_PLAN_CONFIG>) => {
    setFuelPlanConfig((current) => ({ ...current, ...patch }));
  };

  return (
    <AppShell currentScreen={currentScreen} onNavigate={setCurrentScreen}>
      {currentScreen === 'home' && <HomeScreen onNavigate={setCurrentScreen} />}
      {currentScreen === 'planning' && (
        <PlanningScreen
          route={routeState.route}
          selectedPointId={routeState.selectedPointId}
          routeMessage={routeState.routeMessage}
          onSelectPoint={routeState.setSelectedPointId}
          onSetDepartureCode={routeState.setDepartureCode}
          onSetDestinationCode={routeState.setDestinationCode}
          onAddWaypointAt={routeState.addWaypointAt}
          onRemovePoint={routeState.removePoint}
          onReverseRoute={routeState.reverseRoute}
          alternateCode={safeAlternateCode}
          onSetAlternateCode={setAlternate}
          onCalculations={() => setCurrentScreen('calculations')}
        />
      )}
      {currentScreen === 'calculations' && (
        <CalculationsScreen
          route={routeState.route}
          weatherStatus={routeState.weatherStatus}
          onSetBranchAltitude={routeState.setBranchAltitudeFt}
          onRefreshWinds={routeState.refreshWinds}
          onSetTasKt={routeState.setTasKt}
          onSetDefaultAltitudeFt={routeState.setDefaultAltitudeFt}
          aircraftProfiles={aircraftState.profiles}
          activeAircraft={aircraftState.activeProfile}
          onSelectAircraft={selectAircraft}
          fuelPlanConfig={fuelPlanConfig}
          onSetFuelPlanConfig={updateFuelPlanConfig}
          alternateCode={safeAlternateCode}
          aerodromeWeatherReports={aerodromeWeatherState.reports}
          aerodromeWeatherStatus={aerodromeWeatherState.status}
          aerodromeWeatherUpdatedAt={aerodromeWeatherState.updatedAtIso}
          onRefreshAerodromeWeather={aerodromeWeatherState.refresh}
          onValidate={() => setCurrentScreen('tracking')}
          onExport={() => setCurrentScreen('traces')}
          onBackPlanning={() => setCurrentScreen('planning')}
        />
      )}
      {currentScreen === 'zones' && <ZonesScreen route={routeState.route} />}
      {currentScreen === 'tracking' && <TrackingScreen route={routeState.route} onTraceReady={traceState.saveTrace} />}
      {currentScreen === 'traces' && <TracesScreen traces={traceState.traces} onDeleteTrace={traceState.deleteTrace} />}
      {currentScreen === 'more' && (
        <MoreScreen
          onNavigate={setCurrentScreen}
          aircraftProfiles={aircraftState.profiles}
          activeAircraft={aircraftState.activeProfile}
          onSelectAircraft={selectAircraft}
          onUpdateAircraft={updateAircraft}
          onCreateAircraft={createAircraft}
        />
      )}
    </AppShell>
  );
}
