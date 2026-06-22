import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Icon, Style } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import type { GpsPosition } from '../domain/gps.types';

export type AircraftLayer = VectorLayer<VectorSource<Feature<Point>>>;

const AIRCRAFT_FEATURE_ID = 'aircraft-marker';
const LAST_HEADING_PROPERTY = 'lastReliableTrackDeg';

const AIRCRAFT_SVG_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80">
  <path d="M32 3 C35 13 37 25 38 37 L58 49 L58 59 L37 52 L35 63 L43 70 L43 76 L32 71 L21 76 L21 70 L29 63 L27 52 L6 59 L6 49 L26 37 C27 25 29 13 32 3 Z" fill="#F3F7FA" stroke="#07111C" stroke-width="5" stroke-linejoin="round"/>
  <path d="M32 7 C34 17 35 28 36 39 L32 44 L28 39 C29 28 30 17 32 7 Z" fill="#59CFFF" opacity="0.95"/>
</svg>
`)}`;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeHeading(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

function scaleForZoom(zoom?: number): number {
  if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return 0.44;
  const safeZoom = clamp(zoom, 6, 14);
  const normalized = (safeZoom - 6) / 8;
  return Number((0.30 + normalized * 0.30).toFixed(3));
}

function headingForPosition(layer: AircraftLayer, position: GpsPosition | null): number {
  if (!position) return Number(layer.get(LAST_HEADING_PROPERTY) ?? 0);
  const hasTrack = typeof position.track === 'number' && Number.isFinite(position.track);
  const hasReliableSpeed = typeof position.vitesse === 'number' && position.vitesse >= 5;

  if (hasTrack && hasReliableSpeed) {
    const heading = normalizeHeading(position.track as number);
    layer.set(LAST_HEADING_PROPERTY, heading);
    return heading;
  }

  return Number(layer.get(LAST_HEADING_PROPERTY) ?? 0);
}

function createAircraftStyle(headingDeg: number, zoom?: number): Style {
  return new Style({
    image: new Icon({
      src: AIRCRAFT_SVG_URL,
      anchor: [0.5, 0.5],
      scale: scaleForZoom(zoom),
      rotation: (normalizeHeading(headingDeg) * Math.PI) / 180,
      rotateWithView: true
    })
  });
}

export function createAircraftLayer(position: GpsPosition | null = null, zoom?: number): AircraftLayer {
  const source = new VectorSource<Feature<Point>>();
  const layer = new VectorLayer({
    source,
    style: createAircraftStyle(0, zoom),
    properties: { name: 'aircraft', [LAST_HEADING_PROPERTY]: 0 },
    renderBuffer: 64,
    zIndex: 40
  });
  updateAircraftLayer(layer, position, zoom);
  return layer;
}

export function updateAircraftLayer(layer: AircraftLayer, position: GpsPosition | null, zoom?: number): void {
  const source = layer.getSource();
  if (!source) return;

  const previousFeature = source.getFeatureById(AIRCRAFT_FEATURE_ID) as Feature<Point> | null;
  if (!position) {
    if (previousFeature) source.removeFeature(previousFeature);
    return;
  }

  const heading = headingForPosition(layer, position);
  const coordinate = fromLonLat([position.longitude, position.latitude]);

  if (previousFeature) {
    previousFeature.getGeometry()?.setCoordinates(coordinate);
  } else {
    const feature = new Feature(new Point(coordinate));
    feature.setId(AIRCRAFT_FEATURE_ID);
    source.addFeature(feature);
  }

  layer.setStyle(createAircraftStyle(heading, zoom));
}
