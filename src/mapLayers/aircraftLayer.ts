import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, RegularShape } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import type { GpsPosition } from '../domain/gps.types';

export type AircraftLayer = VectorLayer<VectorSource<Feature<Point>>>;

const AIRCRAFT_FEATURE_ID = 'aircraft-marker';

function createAircraftStyle(position: GpsPosition | null): Style {
  return new Style({
    image: new RegularShape({
      points: 3,
      radius: 17,
      rotation: ((position?.track ?? 0) * Math.PI) / 180,
      rotateWithView: true,
      fill: new Fill({ color: '#F3F7FA' }),
      stroke: new Stroke({ color: '#07111C', width: 3 })
    })
  });
}

export function createAircraftLayer(position: GpsPosition | null = null): AircraftLayer {
  const source = new VectorSource<Feature<Point>>();
  const layer = new VectorLayer({
    source,
    style: createAircraftStyle(position),
    properties: { name: 'aircraft' },
    renderBuffer: 48,
    zIndex: 40
  });
  updateAircraftLayer(layer, position);
  return layer;
}

export function updateAircraftLayer(layer: AircraftLayer, position: GpsPosition | null): void {
  const source = layer.getSource();
  if (!source) return;

  source.clear(true);
  if (!position) return;

  const feature = new Feature(new Point(fromLonLat([position.longitude, position.latitude])));
  feature.setId(AIRCRAFT_FEATURE_ID);
  source.addFeature(feature);
  layer.setStyle(createAircraftStyle(position));
}
