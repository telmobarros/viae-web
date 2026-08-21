/**
 * Theme-aware raster basemap, geographic scenes only.
 *
 * Lifted from LiveRoutes.jsx, which hardcoded `dark_all` regardless of the
 * app's own light/dark setting. Made theme-aware here since it is now shared
 * infrastructure rather than one view's private choice, and mounting is
 * gated by `supportsBasemap` -- a raster basemap under Cartesian coordinates
 * is not a style choice, it is a bug (see adapters/assertScene.js).
 *
 * The theme->URL mapping lives in ./basemapStyle.js, split out because it
 * has no deck.gl import and this file does -- see basemapStyle.js.
 */
import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';

import { supportsBasemap } from '../view/resolveView';
import { tileUrlFor } from './basemapStyle';

export { tileUrlFor };

/**
 * @param {'geo'|'plane2d'|'plane3d'} spaceMode
 * @param {'light'|'dark'} themeMode
 * @returns {TileLayer|null}
 */
export function buildBasemapLayer(spaceMode, themeMode) {
    if (!supportsBasemap(spaceMode)) return null;
    return new TileLayer({
        id: 'viae-map-basemap',
        data: tileUrlFor(themeMode),
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        renderSubLayers: (props) => {
            const { west, south, east, north } = props.tile.bbox;
            return new BitmapLayer(props, {
                data: null,
                image: props.data,
                bounds: [west, south, east, north]
            });
        }
    });
}
