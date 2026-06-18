import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

export function createOpenAipRasterLayer() {
  return new TileLayer({
    source: new XYZ({
      url: '/api/openaip/tiles/{z}/{x}/{y}.png',
      tileSize: 256,
      minZoom: 6,
      maxZoom: 16,
      crossOrigin: 'anonymous',
      transition: 0,
      attributions: '© openAIP'
    }),
    opacity: 0.92,
    preload: 0,
    visible: true,
    properties: {
      name: 'openaip-raster-aero-overlay'
    }
  });
}
