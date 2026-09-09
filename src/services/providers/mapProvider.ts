import L from 'leaflet';

export interface MapTileProvider {
  id: string;
  name: string;
  urlTemplate: string;
  options: L.TileLayerOptions;
}

export const OPENSTREETMAP_PROVIDER: MapTileProvider = {
  id: 'osm-standard',
  name: 'OpenStreetMap',
  urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: ['a', 'b', 'c'],
  },
};

export const CARTO_VOYAGER_PROVIDER: MapTileProvider = {
  id: 'carto-voyager',
  name: 'Carto Voyager (Clean & Modern)',
  urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  options: {
    maxZoom: 20,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

// Default tile provider for Raksha Sutra Journey Mode (OpenStreetMap is 100% free with no watermark)
export const DEFAULT_MAP_PROVIDER = OPENSTREETMAP_PROVIDER;

export function createMapTileLayer(provider: MapTileProvider = DEFAULT_MAP_PROVIDER): L.TileLayer {
  return L.tileLayer(provider.urlTemplate, provider.options);
}
