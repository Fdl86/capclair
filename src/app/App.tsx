import { useEffect, useState } from 'react';
import type { ScreenId } from './routes';
import { findAerodrome } from '../data/aerodromeCatalog';
import { AppShell } from '../components/layout/AppShell';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PlanningScreen } from '../screens/PlanningScreen';
import { CalculationsScreen } from '../screens/CalculationsScreen';
import { TrackingScreen } from '../screens/TrackingScreen';
import { TracesScreen } from '../screens/TracesScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { useActiveRoute } from '../hooks/useActiveRoute';
import { useTraces } from '../hooks/useTraces';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { useAircraftProfiles } from '../hooks/useAircraftProfiles';
import { useAerodromeWeather } from '../hooks/useAerodromeWeather';
import { DEFAULT_FUEL_PLAN_CONFIG } from '../domain/aircraft.types';
import type { MapBaseLayer } from '../mapEngine/mapTypes';
import { isRouteReady, routeMissingMessage } from '../services/navigation/routeValidation';

function routeEndpointCode(route: ReturnType<typeof useActiveRoute>['route'], type: 'depart' | 'destination') {
  return route.points.find((point) => point.type === type)?.code ?? '';
}

function safeAerodromeCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return '';
  return findAerodrome(normalized) ? normalized : '';
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('planning');
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [trackingRecording, setTrackingRecording] = useState(false);
  const [pendingScreen, setPendingScreen] = useState<ScreenId | null>(null);
  const routeState = useActiveRoute();
  const traceState = useTraces();
  const aircraftState = useAircraftProfiles();
  const [alternateCode, setAlternateCode] = useLocalStorageState('capclair.alternateCode.v2.web', '');
  const [fuelPlanConfigRaw, setFuelPlanConfig] = useLocalStorageState('capclair.fuelPlan.v1', DEFAULT_FUEL_PLAN_CONFIG);
  const [mapBaseLayer, setMapBaseLayer] = useLocalStorageState<MapBaseLayer>('capclair.mapBaseLayer.v1', 'free');
  const fuelPlanConfig = { ...DEFAULT_FUEL_PLAN_CONFIG, ...fuelPlanConfigRaw };
  const ready = isRouteReady(routeState.route);

  const departureCode = routeEndpointCode(routeState.route, 'depart');
  const destinationCode = routeEndpointCode(routeState.route, 'destination');
  const safeAlternateCode = safeAerodromeCode(alternateCode);
  const aerodromeWeatherState = useAerodromeWeather([departureCode, destinationCode, safeAlternateCode].filter(Boolean));

  useEffect(() => {
    const profileTasKt = aircraftState.activeProfile.cruiseTasKt;
    if (routeState.route.profile.tasKt !== profileTasKt) {
      routeState.setTasKt(profileTasKt);
    }
  }, [aircraftState.activeProfile.id, aircraftState.activeProfile.cruiseTasKt, routeState.route.profile.tasKt]);

  useEffect(() => {
    setFuelPlanConfig((current) => ({
      ...current,
      finalReserveMin: aircraftState.activeProfile.reserveMinutes
    }));
  }, [aircraftState.activeProfile.id]);

  const navigate = (screen: ScreenId) => {
    setAppNotice(null);

    if ((screen === 'calculations' || screen === 'tracking') && !ready) {
      const message = routeMissingMessage(routeState.route);
      routeState.setRouteMessage(message);
      setAppNotice(message);
      setCurrentScreen('planning');
      return;
    }

    if (currentScreen === 'tracking' && trackingRecording && screen !== 'tracking') {
      setPendingScreen(screen);
      return;
    }

    setCurrentScreen(screen);
  };

  const setAlternate = (code: string): boolean => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setAlternateCode('');
      return true;
    }
    if (!findAerodrome(normalized)) return false;
    setAlternateCode(normalized);
    return true;
  };

  const selectAircraft = (profileId: string) => {
    const selected = aircraftState.selectProfile(profileId);
    routeState.setTasKt(selected.cruiseTasKt);
    setFuelPlanConfig((current) => ({ ...current, finalReserveMin: selected.reserveMinutes }));
  };

  const updateAircraft = (profileId: string, patch: Parameters<typeof aircraftState.updateProfile>[1]) => {
    const updated = aircraftState.updateProfile(profileId, patch);
    if (profileId !== aircraftState.activeProfile.id) return;
    if (typeof patch.cruiseTasKt === 'number') routeState.setTasKt(updated.cruiseTasKt);
    if (typeof patch.reserveMinutes === 'number') {
      setFuelPlanConfig((current) => ({ ...current, finalReserveMin: updated.reserveMinutes }));
    }
  };

  const createAircraft = () => {
    const profile = aircraftState.createProfile();
    routeState.setTasKt(profile.cruiseTasKt);
    setFuelPlanConfig((current) => ({ ...current, finalReserveMin: profile.reserveMinutes }));
  };

  const resetNavigation = () => {
    routeState.resetRoute(aircraftState.activeProfile.cruiseTasKt);
    setAlternateCode('');
    setAppNotice(null);
  };

  const updateFuelPlanConfig = (patch: Partial<typeof DEFAULT_FUEL_PLAN_CONFIG>) => {
    setFuelPlanConfig((current) => ({
      ...current,
      ...patch,
      finalReserveMin: clamp(patch.finalReserveMin ?? current.finalReserveMin, 0, 180),
      marginLiters: clamp(patch.marginLiters ?? current.marginLiters ?? 0, 0, 500)
    }));
  };

  return (
    <AppShell currentScreen={currentScreen} onNavigate={navigate}>
      {appNotice && (
        <div className="app-notice" role="status">
          <span>{appNotice}</span>
          <button type="button" onClick={() => setAppNotice(null)} aria-label="Fermer">×</button>
        </div>
      )}

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
          onResetRoute={resetNavigation}
          alternateCode={safeAlternateCode}
          onSetAlternateCode={setAlternate}
          onCalculations={() => navigate('calculations')}
          mapBaseLayer={mapBaseLayer}
          onMapBaseLayerChange={setMapBaseLayer}
        />
      )}
      {currentScreen === 'calculations' && (
        <CalculationsScreen
          route={routeState.route}
          weatherStatus={routeState.weatherStatus}
          onSetBranchAltitude={routeState.setBranchAltitudeFt}
          onRefreshWinds={routeState.refreshWinds}
          onSetTasKt={(tasKt) => updateAircraft(aircraftState.activeProfile.id, { cruiseTasKt: tasKt })}
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
          onValidate={() => navigate('tracking')}
          onBackPlanning={() => navigate('planning')}
        />
      )}
      {currentScreen === 'tracking' && (
        <TrackingScreen
          route={routeState.route}
          onTraceReady={traceState.saveTrace}
          mapBaseLayer={mapBaseLayer}
          onMapBaseLayerChange={setMapBaseLayer}
          onRecordingStateChange={setTrackingRecording}
        />
      )}
      {currentScreen === 'traces' && (
        <TracesScreen
          traces={traceState.traces}
          onDeleteTrace={traceState.deleteTrace}
          isLoading={traceState.isLoading}
          storageMode={traceState.storageMode}
          storageMessage={traceState.storageMessage}
        />
      )}
      {currentScreen === 'more' && (
        <MoreScreen
          onNavigate={navigate}
          aircraftProfiles={aircraftState.profiles}
          activeAircraft={aircraftState.activeProfile}
          onSelectAircraft={selectAircraft}
          onUpdateAircraft={updateAircraft}
          onCreateAircraft={createAircraft}
        />
      )}

      <ConfirmDialog
        open={pendingScreen !== null}
        title="Quitter le suivi en cours ?"
        message="La trace active ne sera pas sauvegardée. Annulez puis utilisez Arrêter et sauvegarder pour la conserver."
        confirmLabel="Quitter sans sauvegarder"
        onCancel={() => setPendingScreen(null)}
        onConfirm={() => {
          const target = pendingScreen;
          setPendingScreen(null);
          setTrackingRecording(false);
          if (target) setCurrentScreen(target);
        }}
      />
    </AppShell>
  );
}
