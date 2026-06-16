export interface WmtsSourceConfig {
  url: string;
  layer: string;
  apiKey: string;
  tileMatrixSet: string;
}

export const wmtsSourceConfig: WmtsSourceConfig = {
  url: import.meta.env.VITE_IGN_WMTS_URL || 'https://data.geopf.fr/private/wmts',
  layer: import.meta.env.VITE_IGN_WMTS_LAYER || 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI',
  apiKey: import.meta.env.VITE_IGN_WMTS_API_KEY || 'ign_scan_ws',
  tileMatrixSet: import.meta.env.VITE_IGN_WMTS_TILE_MATRIX_SET || 'PM'
};

export function buildCapabilitiesUrl(config: WmtsSourceConfig): string {
  const url = new URL(config.url);
  url.searchParams.set('SERVICE', 'WMTS');
  url.searchParams.set('VERSION', '1.0.0');
  url.searchParams.set('REQUEST', 'GetCapabilities');
  if (config.apiKey) url.searchParams.set('apikey', config.apiKey);
  return url.toString();
}
