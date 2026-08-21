/**
 * Pure route/stop styling logic, deck.gl-free -- see nodeStyle.js for why
 * that split matters for testability under this project's jest setup.
 *
 * Selected/hovered routes must read as visually distinct WITHOUT making
 * every other route unreadable (explicit Phase 5 requirement): the approach
 * here is that a route only dims when something ELSE is selected -- with no
 * selection at all, every route renders at full strength.
 */
const BASE_ALPHA = 210;
const DIMMED_ALPHA = 70;
const ACTIVE_ALPHA = 255;

const BASE_WIDTH = 2.5;
const HOVER_WIDTH = 4;
const SELECTED_WIDTH = 5.5;

/**
 * @param {number[]} baseColor [r,g,b]
 * @param {number|string} routeId
 * @param {number|string|null} hoveredRouteId
 * @param {number|string|null} selectedRouteId
 * @returns {number[]} [r,g,b,a]
 */
export function routeRenderColor(baseColor, routeId, hoveredRouteId, selectedRouteId) {
    const isSelected = routeId === selectedRouteId;
    const isHovered = routeId === hoveredRouteId;
    let alpha = BASE_ALPHA;
    if (selectedRouteId != null && !isSelected) alpha = DIMMED_ALPHA;
    if (isSelected || isHovered) alpha = ACTIVE_ALPHA;
    return [baseColor[0], baseColor[1], baseColor[2], alpha];
}

/**
 * @param {number|string} routeId
 * @param {number|string|null} hoveredRouteId
 * @param {number|string|null} selectedRouteId
 */
export function routeRenderWidth(routeId, hoveredRouteId, selectedRouteId) {
    if (routeId === selectedRouteId) return SELECTED_WIDTH;
    if (routeId === hoveredRouteId) return HOVER_WIDTH;
    return BASE_WIDTH;
}

/** Stop markers render a shade smaller than background nodes so they read as "on the route", not competing with it. */
export function stopRadiusPropsFor(spaceMode) {
    const isGeo = spaceMode === 'geo';
    return {
        radiusUnits: isGeo ? 'meters' : 'pixels',
        getRadius: isGeo ? 30 : 4,
        radiusMinPixels: isGeo ? 2 : 2,
        radiusMaxPixels: isGeo ? 10 : 8
    };
}
