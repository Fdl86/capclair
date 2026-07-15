import { useEffect, useMemo, useRef, useState } from 'react';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import { defaults as defaultInteractions } from 'ol/interaction/defaults';
import View from 'ol/View';
import LineString from 'ol/geom/LineString';
import MultiLineString from 'ol/geom/MultiLineString';
import Point from 'ol/geom/Point';
import type Geometry from 'ol/geom/Geometry';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import { boundingExtent } from 'ol/extent';
import { fromLonLat } from 'ol/proj';
import type { GpsPosition } from '../../domain/gps.types';
import type { ReplayModel } from '../../domain/replay.types';
import type { PlannedRouteSnapshot } from '../../domain/trace.types';
import type { MapBaseLayer, MapSourceStatus } from '../../mapEngine/mapTypes';
import { initialMapCenter, initialMapZoom } from '../../mapEngine/mapViewConfig';
import { createAircraftLayer, updateAircraftLayer, type AircraftLayer } from '../../mapLayers/aircraftLayer';
import { createSupAipLayer, supAipSelectionFromFeature, type SupAipLayer } from '../../mapLayers/supAipLayer';
import type { SupAipSelection } from '../../domain/supaip.types';
import {
  applySupAipVisibility,
  DEFAULT_SUP_AIP_VISIBILITY_SETTINGS,
  formatSupAipAltitudeCeiling,
  normalizeSupAipVisibilitySettings,
  type SupAipVisibilitySettings
} from '../../services/supaip/supAipVisibility';
import { createFreeMapLayer } from '../../mapSources/freeMapSource';
import { createIgnOaciVfrLayer } from '../../mapSources/ignOaciVfrSource';
import { createOpenAipRasterLayer } from '../../mapSources/openAipRasterSource';
import { MapControls } from '../map/MapControls';
import { MapFallbackNotice } from '../map/MapFallbackNotice';
import { SupAipPopup } from '../map/SupAipPopup';

interface ReplayMapProps {
  model: ReplayModel;
  aircraft: GpsPosition | null;
  plannedRoute?: PlannedRouteSnapshot;
  showPlannedRoute: boolean;
  baseLayer: MapBaseLayer;
  followAircraft: boolean;
  supAipSettings?: SupAipVisibilitySettings;
}

type TraceLayer = VectorLayer<VectorSource<Feature<MultiLineString>>>;
type RouteLayer = VectorLayer<VectorSource<Feature<LineString>>>;
type WaypointLayer = VectorLayer<VectorSource<Feature<Point>>>;

function createTraceLayer(): TraceLayer {
  const feature = new Feature(new MultiLineString([]));
  feature.setId('replay-trace');
  return new VectorLayer({
    source: new VectorSource({ features: [feature] }),
    style: [
      new Style({ stroke: new Stroke({ color: 'rgba(5, 11, 18, 0.82)', width: 8, lineCap: 'round', lineJoin: 'round' }) }),
      new Style({ stroke: new Stroke({ color: '#FF3FA4', width: 4.5, lineCap: 'round', lineJoin: 'round' }) })
    ],
    properties: { name: 'replay-actual-trace' },
    renderBuffer: 48,
    zIndex: 32
  });
}

function createRouteLayer(): RouteLayer {
  const feature = new Feature(new LineString([]));
  feature.setId('replay-planned-route');
  return new VectorLayer({
    source: new VectorSource({ features: [feature] }),
    style: new Style({
      stroke: new Stroke({ color: '#18AEEF', width: 3, lineDash: [10, 8], lineCap: 'round', lineJoin: 'round' })
    }),
    properties: { name: 'replay-planned-route' },
    zIndex: 30
  });
}

function createWaypointLayer(): WaypointLayer {
  return new VectorLayer({
    source: new VectorSource(),
    style: (feature) => new Style({
      image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#07111C' }), stroke: new Stroke({ color: '#59CFFF', width: 2 }) }),
      text: new Text({
        text: String(feature.get('label') ?? ''),
        offsetY: 16,
        font: '800 11px system-ui',
        fill: new Fill({ color: '#F3F7FA' }),
        stroke: new Stroke({ color: '#07111C', width: 3 })
      })
    }),
    properties: { name: 'replay-planned-waypoints' },
    zIndex: 31
  });
}

function traceCoordinates(model: ReplayModel): number[][][] {
  return model.segments.map((segment) => model.points
    .slice(segment.startPointIndex, segment.endPointIndex + 1)
    .map((point) => fromLonLat([point.position.longitude, point.position.latitude])))
    .filter((segment) => segment.length >= 2);
}

export function ReplayMap({ model, aircraft, plannedRoute, showPlannedRoute, baseLayer, followAircraft, supAipSettings = DEFAULT_SUP_AIP_VISIBILITY_SETTINGS }: ReplayMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const traceLayerRef = useRef<TraceLayer | null>(null);
  const routeLayerRef = useRef<RouteLayer | null>(null);
  const waypointLayerRef = useRef<WaypointLayer | null>(null);
  const aircraftLayerRef = useRef<AircraftLayer | null>(null);
  const supAipLayerRef = useRef<SupAipLayer | null>(null);
  const supAipSettingsRef = useRef<SupAipVisibilitySettings>(normalizeSupAipVisibilitySettings(supAipSettings));
  const supAipRoutePointsRef = useRef<Array<{ latitude: number; longitude: number }>>([]);
  const latestAircraftRef = useRef<GpsPosition | null>(aircraft);
  const baseLayerModeRef = useRef<MapBaseLayer>(baseLayer);
  const fittedModelRef = useRef<ReplayModel | null>(null);
  const [sourceStatus, setSourceStatus] = useState<MapSourceStatus>('free');
  const [supAipLoadState, setSupAipLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [supAipFeatureCount, setSupAipFeatureCount] = useState(0);
  const [supAipVisibleCount, setSupAipVisibleCount] = useState(0);
  const [selectedSupAip, setSelectedSupAip] = useState<SupAipSelection | null>(null);
  const normalizedSupAipSettings = normalizeSupAipVisibilitySettings(supAipSettings);
  const showSupAip = normalizedSupAipSettings.mode !== 'off';
  const supAipRoutePoints = useMemo(() => {
    const plannedPoints = plannedRoute?.points ?? [];
    if (plannedPoints.length >= 2) return plannedPoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
    return model.points.map((point) => ({ latitude: point.position.latitude, longitude: point.position.longitude }));
  }, [model, plannedRoute]);
  supAipRoutePointsRef.current = supAipRoutePoints;

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const freeLayer = createFreeMapLayer();
    const openAipLayer = createOpenAipRasterLayer(() => {
      if (baseLayerModeRef.current === 'free') setSourceStatus('fallback');
    });
    const oaciLayer = createIgnOaciVfrLayer(() => {
      if (baseLayerModeRef.current === 'oaci') setSourceStatus('error');
    });
    const traceLayer = createTraceLayer();
    const routeLayer = createRouteLayer();
    const waypointLayer = createWaypointLayer();
    const aircraftLayer = createAircraftLayer(null, 9);
    const supAipLayer = createSupAipLayer({
      visible: false,
      onLoadStart: () => setSupAipLoadState('loading'),
      onLoadEnd: (featureCount) => {
        setSupAipFeatureCount(featureCount);
        setSupAipLoadState('ready');
        setSupAipVisibleCount(applySupAipVisibility(supAipLayer, supAipRoutePointsRef.current, supAipSettingsRef.current));
      },
      onLoadError: () => setSupAipLoadState('error')
    });

    traceLayerRef.current = traceLayer;
    routeLayerRef.current = routeLayer;
    waypointLayerRef.current = waypointLayer;
    aircraftLayerRef.current = aircraftLayer;
    supAipLayerRef.current = supAipLayer;

    const map = new Map({
      target: elementRef.current,
      controls: [],
      interactions: defaultInteractions({ altShiftDragRotate: false, pinchRotate: false }),
      layers: [freeLayer, oaciLayer, openAipLayer, supAipLayer, routeLayer, waypointLayer, traceLayer, aircraftLayer],
      view: new View({ center: initialMapCenter, zoom: initialMapZoom, minZoom: 6, maxZoom: 14, rotation: 0, smoothResolutionConstraint: false })
    });
    mapRef.current = map;

    const observer = new ResizeObserver(() => map.updateSize());
    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
      freeLayer.dispose();
      openAipLayer.dispose();
      oaciLayer.dispose();
      routeLayer.dispose();
      waypointLayer.dispose();
      traceLayer.dispose();
      aircraftLayer.dispose();
      supAipLayer.dispose();
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    baseLayerModeRef.current = baseLayer;
    const map = mapRef.current;
    if (!map) return;
    const layers = map.getLayers().getArray();
    layers.forEach((layer) => {
      const name = layer.get('name');
      if (name === 'free-osm-dev' || name === 'openaip-raster-aero-overlay') layer.setVisible(baseLayer === 'free');
      if (name === 'ign-sia-oaci-vfr-500k') layer.setVisible(baseLayer === 'oaci');
    });
    setSourceStatus(baseLayer === 'oaci' ? 'oaci' : 'free');
  }, [baseLayer]);

  useEffect(() => {
    const settings = normalizeSupAipVisibilitySettings(supAipSettings);
    supAipSettingsRef.current = settings;
    supAipRoutePointsRef.current = supAipRoutePoints;
    const layer = supAipLayerRef.current;
    if (layer) setSupAipVisibleCount(applySupAipVisibility(layer, supAipRoutePoints, settings));
    setSelectedSupAip(null);
  }, [supAipRoutePoints, supAipSettings]);

  useEffect(() => {
    if (!showSupAip) return undefined;
    const interval = window.setInterval(() => supAipLayerRef.current?.changed(), 60_000);
    return () => window.clearInterval(interval);
  }, [showSupAip]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showSupAip) return undefined;

    const handleSupAipClick = (event: MapBrowserEvent) => {
      const layer = supAipLayerRef.current;
      if (!layer) return;
      const selected = map.forEachFeatureAtPixel(
        event.pixel,
        (feature) => supAipSelectionFromFeature(feature as Feature<Geometry>),
        { hitTolerance: 8, layerFilter: (candidate) => candidate === layer }
      );
      setSelectedSupAip(selected ?? null);
    };

    map.on('singleclick', handleSupAipClick);
    return () => map.un('singleclick', handleSupAipClick);
  }, [showSupAip]);

  useEffect(() => {
    const layer = traceLayerRef.current;
    const map = mapRef.current;
    const feature = layer?.getSource()?.getFeatureById('replay-trace');
    feature?.getGeometry()?.setCoordinates(traceCoordinates(model));
    if (!map || model.points.length === 0 || fittedModelRef.current === model) return;
    fittedModelRef.current = model;
    const coordinates = model.points.map((point) => fromLonLat([point.position.longitude, point.position.latitude]));
    if (coordinates.length === 1) {
      map.getView().setCenter(coordinates[0]);
      map.getView().setZoom(11);
      return;
    }
    map.getView().fit(boundingExtent(coordinates), { padding: [54, 46, 54, 46], duration: 0, maxZoom: 12 });
  }, [model]);

  useEffect(() => {
    const coordinates = (plannedRoute?.points ?? []).map((point) => fromLonLat([point.longitude, point.latitude]));
    const feature = routeLayerRef.current?.getSource()?.getFeatureById('replay-planned-route');
    feature?.getGeometry()?.setCoordinates(coordinates);
    routeLayerRef.current?.setVisible(showPlannedRoute && coordinates.length >= 2);

    const source = waypointLayerRef.current?.getSource();
    if (!source) return;
    source.clear();
    if (!showPlannedRoute) return;
    (plannedRoute?.points ?? []).forEach((point) => {
      const waypoint = new Feature(new Point(fromLonLat([point.longitude, point.latitude])));
      waypoint.set('label', point.code || point.nom);
      source.addFeature(waypoint);
    });
    waypointLayerRef.current?.setVisible(showPlannedRoute);
  }, [plannedRoute, showPlannedRoute]);

  useEffect(() => {
    latestAircraftRef.current = aircraft;
    const map = mapRef.current;
    const layer = aircraftLayerRef.current;
    if (!layer) return;
    updateAircraftLayer(layer, aircraft, map?.getView().getZoom());
    if (!map) return;
    map.getView().setRotation(0);
    if (followAircraft && aircraft) {
      const view = map.getView();
      view.setCenter(fromLonLat([aircraft.longitude, aircraft.latitude]));
      if ((view.getZoom() ?? 0) < 10) view.setZoom(10);
    }
  }, [aircraft, followAircraft]);

  useEffect(() => {
    if (!followAircraft) fitTrace();
  }, [followAircraft]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = aircraftLayerRef.current;
    if (!map || !layer) return undefined;
    const listener = () => updateAircraftLayer(layer, latestAircraftRef.current, map.getView().getZoom());
    map.getView().on('change:resolution', listener);
    return () => map.getView().un('change:resolution', listener);
  }, []);

  const fitTrace = () => {
    const map = mapRef.current;
    if (!map || model.points.length === 0) return;
    const coordinates = model.points.map((point) => fromLonLat([point.position.longitude, point.position.latitude]));
    map.getView().setRotation(0);
    map.getView().fit(boundingExtent(coordinates), { padding: [54, 46, 86, 46], duration: 180, maxZoom: 12 });
  };

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (followAircraft && aircraft) {
      map.getView().animate({ center: fromLonLat([aircraft.longitude, aircraft.latitude]), zoom: Math.max(10, map.getView().getZoom() ?? 10), rotation: 0, duration: 160 });
      return;
    }
    fitTrace();
  };

  const zoom = (delta: number) => {
    const view = mapRef.current?.getView();
    if (!view) return;
    view.animate({ zoom: (view.getZoom() ?? initialMapZoom) + delta, duration: 120 });
  };

  return (
    <div className="replay-map-shell">
      <div ref={elementRef} className="replay-ol-map" aria-label="Carte du replay CAP CLAIR" />
      <MapControls onRecenter={recenter} onZoomIn={() => zoom(1)} onZoomOut={() => zoom(-1)} />
      {showSupAip && (
        <div className={`supaip-beta-notice ${supAipLoadState === 'error' ? 'error' : ''}`}>
          {supAipLoadState === 'error'
            ? 'SUP AIP BETA - données indisponibles'
            : normalizedSupAipSettings.mode === 'route'
              ? `SUP AIP BETA - ROUTE ${normalizedSupAipSettings.routeCorridorNm} NM - ${formatSupAipAltitudeCeiling(normalizedSupAipSettings.maxDisplayFlightLevel)} - ${supAipVisibleCount}/${supAipFeatureCount} zones`
              : `SUP AIP BETA - TOUS - ${formatSupAipAltitudeCeiling(normalizedSupAipSettings.maxDisplayFlightLevel)} - ${supAipVisibleCount}/${supAipFeatureCount} zones`}
        </div>
      )}
      {selectedSupAip && <SupAipPopup selection={selectedSupAip} onClose={() => setSelectedSupAip(null)} />}
      {(sourceStatus === 'fallback' || sourceStatus === 'error') && <MapFallbackNotice mode={sourceStatus === 'error' ? 'oaci' : 'openaip'} />}
    </div>
  );
}
