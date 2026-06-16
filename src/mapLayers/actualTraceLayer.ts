import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Stroke, Style } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import type { GpsPosition } from '../domain/gps.types';

export type ActualTraceLayer = VectorLayer<VectorSource<Feature<LineString>>>;

const TRACE_FEATURE_ID = 'actual-trace-line';

function toCoordinates(positions: GpsPosition[]) {
  return positions.map((position) => fromLonLat([position.longitude, position.latitude]));
}

export function createActualTraceLayer(positions: GpsPosition[] = []): ActualTraceLayer {
  const feature = new Feature(new LineString(toCoordinates(positions)));
  feature.setId(TRACE_FEATURE_ID);

  return new VectorLayer({
    source: new VectorSource({ features: [feature] }),
    style: new Style({
      stroke: new Stroke({ color: '#FF9A3D', width: 3, lineCap: 'round', lineJoin: 'round' })
    }),
    properties: { name: 'actual-trace' },
    renderBuffer: 32,
    zIndex: 21
  });
}

export function updateActualTraceLayer(layer: ActualTraceLayer, positions: GpsPosition[]): void {
  const feature = layer.getSource()?.getFeatureById(TRACE_FEATURE_ID);
  const geometry = feature?.getGeometry();
  if (!geometry) return;
  geometry.setCoordinates(toCoordinates(positions));
}
