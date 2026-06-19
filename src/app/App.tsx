import { useState } from 'react';
import type { ScreenId } from './routes';
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

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const routeState = useActiveRoute();
  const traceState = useTraces();

  return (
    <AppShell currentScreen={currentScreen} onNavigate={setCurrentScreen}>
      {currentScreen === 'home' && <HomeScreen onNavigate={setCurrentScreen} />}
      {currentScreen === 'planning' && (
        <PlanningScreen
          route={routeState.route}
          selectedPointId={routeState.selectedPointId}
          routeMessage={routeState.routeMessage}
          weatherStatus={routeState.weatherStatus}
          onSelectPoint={routeState.setSelectedPointId}
          onSetDepartureCode={routeState.setDepartureCode}
          onSetDestinationCode={routeState.setDestinationCode}
          onAddWaypointAt={routeState.addWaypointAt}
          onRemovePoint={routeState.removePoint}
          onReverseRoute={routeState.reverseRoute}
          onSetTasKt={routeState.setTasKt}
          onSetDefaultAltitudeFt={routeState.setDefaultAltitudeFt}
          onRefreshWinds={routeState.refreshWinds}
          onCalculations={() => setCurrentScreen('calculations')}
        />
      )}
      {currentScreen === 'calculations' && (
        <CalculationsScreen
          route={routeState.route}
          weatherStatus={routeState.weatherStatus}
          onSetBranchAltitude={routeState.setBranchAltitudeFt}
          onRefreshWinds={routeState.refreshWinds}
          onValidate={() => setCurrentScreen('tracking')}
          onExport={() => setCurrentScreen('traces')}
          onBackPlanning={() => setCurrentScreen('planning')}
        />
      )}
      {currentScreen === 'zones' && <ZonesScreen route={routeState.route} />}
      {currentScreen === 'tracking' && <TrackingScreen route={routeState.route} onTraceReady={traceState.saveTrace} />}
      {currentScreen === 'traces' && <TracesScreen traces={traceState.traces} onDeleteTrace={traceState.deleteTrace} />}
      {currentScreen === 'more' && <MoreScreen onNavigate={setCurrentScreen} />}
    </AppShell>
  );
}
