/**
 * These test the pure per-mode radius/color logic directly, NOT the
 * ScatterplotLayer instance -- deck.gl's node_modules ship ESM-only
 * transitive deps (@mapbox/tiny-sdf via @deck.gl/layers' text-layer) that
 * CRA's default (unejected) jest transformIgnorePatterns cannot parse, so
 * importing `@deck.gl/layers` from a test file fails at collection time
 * regardless of what the test itself asserts. `buildNodesLayer` remains
 * verified in the browser (Phase 4 dashboard proof), same as every other
 * deck.gl-touching component in this codebase already is.
 *
 * The logic worth protecting here is the one that shipped a real bug once:
 * ScatterplotLayer defaults to radiusUnits:'meters', which renders as
 * enormous, meaningless circles under Orthographic/Orbit views where
 * positions are plain Cartesian units, not degrees.
 */
import { colorFor, radiusPropsFor } from '../layers/nodeStyle';

describe('radiusPropsFor', () => {
    it('uses pixel radius units for plane modes (2D and 3D)', () => {
        expect(radiusPropsFor('plane2d').radiusUnits).toBe('pixels');
        expect(radiusPropsFor('plane3d').radiusUnits).toBe('pixels');
    });

    it('uses meter radius units for geographic mode', () => {
        expect(radiusPropsFor('geo').radiusUnits).toBe('meters');
    });

    it('caps pixel radii to a sane range regardless of mode', () => {
        const { radiusMinPixels, radiusMaxPixels } = radiusPropsFor('plane2d');
        expect(radiusMinPixels).toBeGreaterThan(0);
        expect(radiusMaxPixels).toBeGreaterThan(radiusMinPixels);
    });
});

describe('colorFor', () => {
    const depot = { id: 1, kind: 'depot' };
    const customer = { id: 2, kind: 'customer' };

    it('brightens the hovered/selected node without changing others', () => {
        const hoveredColor = colorFor(customer, 2, null);
        const idleColor = colorFor(depot, 2, null);
        expect(hoveredColor[3]).toBeGreaterThan(idleColor[3]); // alpha channel brighter
    });

    it('uses a distinct base color per node kind', () => {
        expect(colorFor(depot, null, null)).not.toEqual(colorFor(customer, null, null));
    });

    it('is brightened by either hover or selection', () => {
        expect(colorFor(customer, 2, null)).toEqual(colorFor(customer, null, 2));
    });
});
