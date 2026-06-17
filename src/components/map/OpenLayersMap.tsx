import { useEffect, useMemo, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import { boundingExtent } from 'ol/extent';
import type BaseLayer from 'ol/layer/Base';
import { createSia500kDevLayer } from '../../mapSources/sia500kDevSource';
import { createDemoFallbackLayer } from '../../mapSources/demoFallbackSource';
import { initialMapCenter, initialMapZoom } from '../../mapEngine/mapViewConfig';
import type { MapSourceStatus } from '../../mapEngine/mapTypes';
import { createPlannedRouteLayer } from '../../mapLayers/plannedRouteLayer';
import { createActualTraceLayer, updateActualTraceLayer, type ActualTraceLayer } from '../../mapLayers/actualTraceLayer';
import { createWaypointLayer } from '../../mapLayers/waypointLayer';
import { createAircraftLayer, updateAircraftLayer, type AircraftLayer } from '../../mapLayers/aircraftLayer';
import { createPrototypeZonesLayer } from '../../mapLayers/prototypeZonesLayer';
import type { GpsPosition } from '../../domain/gps.types';
import type { NavRoute } from '../../domain/navigation.types';
import { MapControls } from './MapControls';
import { MapFallbackNotice } from './MapFallbackNotice';
import { MapAttribution } from './MapAttribution';

interface OpenLayersMapProps {
  route: NavRoute;
  trace: GpsPosition[];
  aircraft: GpsPosition | null;
  selectedPointId: string | null;
  compact?: boolean;
  showZones?: boolean;
  onSourceStatusChange?: (status: MapSourceStatus) => void;
}

function replaceLayer(map: Map, previousLayer: BaseLayer | null, nextLayer: BaseLayer | null): BaseLayer | null {
  if (previousLayer) {
    map.removeLayer(previousLayer);
    previousLayer.dispose();
  }
  if (nextLayer) map.addLayer(nextLayer);
  return nextLayer;
}

export function OpenLayersMap({ route, trace, aircraft, selectedPointId, compact = false, showZones = true, onSourceStatusChange }: OpenLayersMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const plannedRouteLayerRef = useRef<BaseLayer | null>(null);
  const waypointsLayerRef = useRef<BaseLayer | null>(null);
  const zonesLayerRef = useRef<BaseLayer | null>(null);
  const traceLayerRef = useRef<ActualTraceLayer | null>(null);
  const aircraftLayerRef = useRef<AircraftLayer | null>(null);
  const [sourceStatus, setSourceStatus] = useState<MapSourceStatus>('sia-dev');

  const routeExtent = useMemo(() => {
    const coords = route.points.map((point) => fromLonLat([point.longitude, point.latitude]));
    return boundingExtent(coords);
  }, [route.points]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;

    const traceLayer = createActualTraceLayer();
    const aircraftLayer = createAircraftLayer(null);
    traceLayerRef.current = traceLayer;
    aircraftLayerRef.current = aircraftLayer;

    const useSiaDevTiles = true;
    const baseLayer = useSiaDevTiles ? createSia500kDevLayer() : createDemoFallbackLayer();

    const map = new Map({
      target: mapElementRef.current,
      controls: [],
      layers: [baseLayer, traceLayer, aircraftLayer],
      view: new View({
        center: initialMapCenter,
        zoom: initialMapZoom,
        minZoom: 7,
        maxZoom: 13,
        smoothExtentConstraint: false,
        smoothResolutionConstraint: false
      })
    });
    mapRef.current = map;
    setSourceStatus(useSiaDevTiles ? 'sia-dev' : 'fallback');
    onSourceStatusChange?.(useSiaDevTiles ? 'sia-dev' : 'fallback');

    return () => {
      plannedRouteLayerRef.current?.dispose();
      waypointsLayerRef.current?.dispose();
      zonesLayerRef.current?.dispose();
      traceLayerRef.current?.dispose();
      aircraftLayerRef.current?.dispose();
      map.setTarget(undefined);
      mapRef.current = null;
      plannedRouteLayerRef.current = null;
      waypointsLayerRef.current = null;
      zonesLayerRef.current = null;
      traceLayerRef.current = null;
      aircraftLayerRef.current = null;
    };
  }, [onSourceStatusChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    plannedRouteLayerRef.current = replaceLayer(map, plannedRouteLayerRef.current, createPlannedRouteLayer(route.points));
  }, [route.points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    waypointsLayerRef.current = replaceLayer(map, waypointsLayerRef.current, createWaypointLayer(route.points, selectedPointId));
  }, [route.points, selectedPointId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    zonesLayerRef.current = replaceLayer(map, zonesLayerRef.current, showZones ? createPrototypeZonesLayer() : null);
  }, [showZones]);

  useEffect(() => {
    const traceLayer = traceLayerRef.current;
    if (!traceLayer) return;
    updateActualTraceLayer(traceLayer, trace);
  }, [trace]);

  useEffect(() => {
    const aircraftLayer = aircraftLayerRef.current;
    if (!aircraftLayer) return;
    updateAircraftLayer(aircraftLayer, aircraft);
  }, [aircraft]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getView().fit(routeExtent, { padding: compact ? [48, 48, 48, 48] : [70, 55, 90, 55], duration: 0, maxZoom: compact ? 9 : 10 });
  }, [routeExtent, compact]);

  const zoom = (delta: number) => {
    const view = mapRef.current?.getView();
    if (!view) return;
    view.animate({ zoom: (view.getZoom() ?? initialMapZoom) + delta, duration: 120 });
  };

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (aircraft) {
      map.getView().animate({ center: fromLonLat([aircraft.longitude, aircraft.latitude]), duration: 120 });
      return;
    }
    map.getView().fit(routeExtent, { padding: [70, 55, 90, 55], duration: 0, maxZoom: 10 });
  };

  return (
    <div className="map-shell">
      <div ref={mapElementRef} className="ol-map" aria-label="Carte CAP CLAIR" />
      <div className="map-topline">
        <span>{sourceStatus === 'sia-dev' ? 'SIA 500K DEV' : sourceStatus === 'oaci' ? 'Carte OACI-VFR' : sourceStatus === 'loading' ? 'Chargement carte' : 'Fond demo'}</span>
        <span>Données DEV02 test</span>
      </div>
      <MapControls onZoomIn={() => zoom(1)} onZoomOut={() => zoom(-1)} onRecenter={recenter} />
      {sourceStatus === 'fallback' && <MapFallbackNotice />}
      <MapAttribution sourceStatus={sourceStatus} />
    </div>
  );
}
