/**
 * Pure theme -> tile URL mapping, deliberately split out of basemapLayer.js
 * so it has NO deck.gl import. See nodeStyle.js for why that matters for
 * testability under this project's unejected CRA jest config.
 */
const TILE_URL = {
    light: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    dark: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
};

/** @param {'light'|'dark'} themeMode */
export function tileUrlFor(themeMode) {
    return TILE_URL[themeMode] || TILE_URL.dark;
}
