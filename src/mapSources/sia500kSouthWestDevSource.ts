import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

const TILE_ROOT = '/tiles/sia-500k-so-2026-lfca/xyz';

export function createSia500kSouthWestDevLayer() {
  return new TileLayer({
    source: new XYZ({
      url: `${TILE_ROOT}/{z}/{x}/{y}.webp`,
      tileSize: 256,
      minZoom: 7,
      maxZoom: 12,
      wrapX: false,
      transition: 0
    }),
    opacity: 1,
    preload: 0,
    properties: {
      name: 'sia-500k-dev-sud-ouest-lfca'
    }
  });
}
