import { fitBoundsForView } from '../view/fitBounds';

const VIEWPORT = { width: 1000, height: 500, padding: 0 };

const GEO = { kind: 'geo', dims: 2 };
const PLANE2D = { kind: 'plane', dims: 2 };
const PLANE3D = { kind: 'plane', dims: 3 };

describe('fitBoundsForView - orthographic (Euclidean 2D)', () => {
    it('centres on the bbox centre', () => {
        const vs = fitBoundsForView(PLANE2D, [0, 0, 100, 50], VIEWPORT);
        expect(vs.target[0]).toBeCloseTo(50);
        expect(vs.target[1]).toBeCloseTo(25);
    });

    it('uses log2 pixels-per-unit, limited by the tighter axis', () => {
        // 100 world units across 1000px => 10 px/unit => zoom log2(10)
        // 50 world units across 500px  => 10 px/unit => zoom log2(10)
        const vs = fitBoundsForView(PLANE2D, [0, 0, 100, 50], VIEWPORT);
        expect(vs.zoom).toBeCloseTo(Math.log2(10));
    });

    it('is limited by the constraining axis for a wide bbox', () => {
        // 1000 wide over 1000px => 1 px/unit; 10 tall over 500px => 50 px/unit.
        // The width constrains, so zoom = log2(1) = 0.
        const vs = fitBoundsForView(PLANE2D, [0, 0, 1000, 10], VIEWPORT);
        expect(vs.zoom).toBeCloseTo(0);
    });

    it('is limited by the constraining axis for a tall bbox', () => {
        // 10 wide over 1000px => 100 px/unit; 1000 tall over 500px => 0.5 px/unit.
        const vs = fitBoundsForView(PLANE2D, [0, 0, 10, 1000], VIEWPORT);
        expect(vs.zoom).toBeCloseTo(Math.log2(0.5));
    });

    it('does not return Infinity for a degenerate (single point) bbox', () => {
        const vs = fitBoundsForView(PLANE2D, [42, 42, 42, 42], VIEWPORT);
        expect(Number.isFinite(vs.zoom)).toBe(true);
        expect(vs.target[0]).toBeCloseTo(42);
        expect(vs.target[1]).toBeCloseTo(42);
    });

    it('tolerates an inverted bbox rather than producing a negative span', () => {
        const normal = fitBoundsForView(PLANE2D, [0, 0, 100, 50], VIEWPORT);
        const inverted = fitBoundsForView(PLANE2D, [100, 50, 0, 0], VIEWPORT);
        expect(inverted.zoom).toBeCloseTo(normal.zoom);
        expect(inverted.target[0]).toBeCloseTo(normal.target[0]);
    });

    it('falls back to a usable view for a missing/garbage bbox', () => {
        [undefined, null, [], [NaN, 0, 1, 1]].forEach((bad) => {
            const vs = fitBoundsForView(PLANE2D, bad, VIEWPORT);
            expect(Number.isFinite(vs.zoom)).toBe(true);
            expect(vs.target.every(Number.isFinite)).toBe(true);
        });
    });

    it('zooms out by exactly 1 when the data spans twice the area', () => {
        const a = fitBoundsForView(PLANE2D, [0, 0, 100, 50], VIEWPORT);
        const b = fitBoundsForView(PLANE2D, [0, 0, 200, 100], VIEWPORT);
        expect(a.zoom - b.zoom).toBeCloseTo(1);
    });
});

describe('fitBoundsForView - orbit (Euclidean 3D)', () => {
    it('returns orbit-shaped viewState with rotation', () => {
        const vs = fitBoundsForView(PLANE3D, [0, 0, 100, 50], VIEWPORT);
        expect(vs).toHaveProperty('rotationX');
        expect(vs).toHaveProperty('rotationOrbit');
        expect(vs.target).toHaveLength(3);
    });

    it('backs off slightly versus the 2D fit so a rotated scene still fits', () => {
        const flat = fitBoundsForView(PLANE2D, [0, 0, 100, 50], VIEWPORT);
        const orbit = fitBoundsForView(PLANE3D, [0, 0, 100, 50], VIEWPORT);
        expect(orbit.zoom).toBeLessThan(flat.zoom);
    });
});

describe('fitBoundsForView - geographic', () => {
    it('returns MapView-shaped viewState centred on the bbox', () => {
        const vs = fitBoundsForView(GEO, [-9, 38, -8, 42], VIEWPORT);
        expect(vs.longitude).toBeCloseTo(-8.5);
        expect(vs.latitude).toBeCloseTo(40);
        expect(vs).not.toHaveProperty('target');
    });

    it('clamps zoom to a range a raster basemap can serve', () => {
        const world = fitBoundsForView(GEO, [-180, -85, 180, 85], VIEWPORT);
        expect(world.zoom).toBeGreaterThanOrEqual(0);
        const tiny = fitBoundsForView(GEO, [-8.5, 40, -8.4999, 40.0001], VIEWPORT);
        expect(tiny.zoom).toBeLessThanOrEqual(20);
    });

    it('zooms in further for a smaller extent', () => {
        const wide = fitBoundsForView(GEO, [-20, 30, 20, 50], VIEWPORT);
        const narrow = fitBoundsForView(GEO, [-9, 38, -8, 42], VIEWPORT);
        expect(narrow.zoom).toBeGreaterThan(wide.zoom);
    });

    it('survives poles without producing NaN (Mercator is undefined at +/-90)', () => {
        const vs = fitBoundsForView(GEO, [-180, -90, 180, 90], VIEWPORT);
        expect(Number.isFinite(vs.zoom)).toBe(true);
    });

    it('does not return Infinity for a single geographic point', () => {
        const vs = fitBoundsForView(GEO, [-8.6, 40.2, -8.6, 40.2], VIEWPORT);
        expect(Number.isFinite(vs.zoom)).toBe(true);
        expect(vs.longitude).toBeCloseTo(-8.6);
    });
});
