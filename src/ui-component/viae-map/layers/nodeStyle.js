/**
 * Pure per-mode node styling logic, deliberately split out of nodesLayer.js
 * so it has NO deck.gl import.
 *
 * `@deck.gl/layers` pulls in `@mapbox/tiny-sdf` (an ESM-only transitive dep,
 * via its text-layer) that this project's unejected CRA jest config cannot
 * transform -- so any test file that imports anything from a module which
 * itself imports `@deck.gl/layers` fails at collection time, regardless of
 * what that test actually asserts. Keeping this logic deck.gl-free is what
 * makes it unit-testable at all; see __tests__/nodesLayer.test.js.
 */
import { NODE_COLORS, withAlpha } from '../palette';

const HOVER_ALPHA = 255;
const BASE_ALPHA = 200;

export function colorFor(node, hoveredId, selectedId) {
    const base = NODE_COLORS[node.kind] || NODE_COLORS.customer;
    const isActive = node.id === hoveredId || node.id === selectedId;
    return withAlpha(base, isActive ? HOVER_ALPHA : BASE_ALPHA);
}

/**
 * Per-mode radius configuration. This is where the "giant overlapping dots"
 * bug lived: ScatterplotLayer defaults to `radiusUnits: 'meters'`,
 * meaningless under Orthographic/Orbit views where positions are plain
 * Cartesian units, not degrees.
 */
export function radiusPropsFor(spaceMode) {
    const isGeo = spaceMode === 'geo';
    return {
        radiusUnits: isGeo ? 'meters' : 'pixels',
        getRadius: isGeo ? 40 : 5,
        radiusMinPixels: isGeo ? 3 : 2,
        radiusMaxPixels: isGeo ? 14 : 10
    };
}
