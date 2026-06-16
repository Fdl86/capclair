import WMTS, { optionsFromCapabilities } from 'ol/source/WMTS';
import WMTSCapabilities from 'ol/format/WMTSCapabilities';
import type { WmtsSourceConfig } from './mapSourceConfig';
import { buildCapabilitiesUrl } from './mapSourceConfig';

export async function createIgnOaciVfrSource(config: WmtsSourceConfig): Promise<WMTS> {
  const response = await fetch(buildCapabilitiesUrl(config), { mode: 'cors' });
  if (!response.ok) throw new Error(`WMTS capabilities failed: ${response.status}`);
  const text = await response.text();
  const parser = new WMTSCapabilities();
  const capabilities = parser.read(text);
  const options = optionsFromCapabilities(capabilities, {
    layer: config.layer,
    matrixSet: config.tileMatrixSet
  });

  if (!options) {
    throw new Error(`WMTS layer not found: ${config.layer}`);
  }

  return new WMTS({
    ...options,
    crossOrigin: 'anonymous',
    wrapX: false
  });
}
