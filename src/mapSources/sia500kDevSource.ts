import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

const TILE_ROOT = '/tiles/sia-500k-no-2026-lfca-tours/xyz';

export function createSia500kDevLayer() {
  return new TileLayer({
    source: new XYZ({
      url: `${TILE_ROOT}/{z}/{x}/{y}.webp`,
      tileSize: 256,
      minZoom: 7,
      maxZoom: 9,
      wrapX: false,
      transition: 0
    }),
    preload: 0,
    properties: {
      name: 'sia-500k-dev-lfca-tours'
    }
  });
}
