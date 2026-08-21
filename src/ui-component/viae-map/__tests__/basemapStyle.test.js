/**
 * Tests the pure theme->URL mapping directly rather than importing
 * `@deck.gl/geo-layers` -- see nodesLayer.test.js for why (ESM transitive
 * deps CRA's default jest config cannot transform). `buildBasemapLayer`
 * itself is verified in the browser during the Phase 4 dashboard proof.
 *
 * What is worth protecting here: the basemap must actually follow the app's
 * light/dark theme rather than being hardcoded to one, which is the defect
 * LiveRoutes.jsx shipped with and the reason this was centralized.
 */
import { supportsBasemap } from '../view/resolveView';
import { tileUrlFor } from '../layers/basemapStyle';

describe('tileUrlFor', () => {
    it('follows the app theme rather than being hardcoded', () => {
        expect(tileUrlFor('dark')).toContain('dark_all');
        expect(tileUrlFor('light')).toContain('light_all');
        expect(tileUrlFor('dark')).not.toEqual(tileUrlFor('light'));
    });

    it('defaults to dark tiles for an unrecognized theme value', () => {
        expect(tileUrlFor(undefined)).toContain('dark_all');
    });
});

describe('supportsBasemap (the gate buildBasemapLayer uses)', () => {
    it('is false for both plane modes -- a raster basemap under Cartesian data is a bug, not a style choice', () => {
        expect(supportsBasemap('plane2d')).toBe(false);
        expect(supportsBasemap('plane3d')).toBe(false);
    });

    it('is true only for geo', () => {
        expect(supportsBasemap('geo')).toBe(true);
    });
});
