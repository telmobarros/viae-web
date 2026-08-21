import { routeRenderColor, routeRenderWidth, stopRadiusPropsFor } from '../layers/routeStyle';

describe('routeRenderColor', () => {
    const blue = [25, 118, 210];

    it('renders every route at full strength when nothing is selected', () => {
        const [, , , a] = routeRenderColor(blue, 1, null, null);
        expect(a).toBeGreaterThan(150);
    });

    it('dims a route when a DIFFERENT route is selected', () => {
        const [, , , dimmedAlpha] = routeRenderColor(blue, 1, null, 2);
        const [, , , selectedAlpha] = routeRenderColor(blue, 2, null, 2);
        expect(dimmedAlpha).toBeLessThan(selectedAlpha);
    });

    it('does NOT dim the selected route itself', () => {
        const [, , , a] = routeRenderColor(blue, 2, null, 2);
        expect(a).toBeGreaterThan(200);
    });

    it('brightens a hovered route even though nothing is selected', () => {
        const [, , , idleAlpha] = routeRenderColor(blue, 1, null, null);
        const [, , , hoveredAlpha] = routeRenderColor(blue, 2, 2, null);
        expect(hoveredAlpha).toBeGreaterThanOrEqual(idleAlpha);
    });

    it('preserves the base RGB, only alpha changes', () => {
        const [r, g, b] = routeRenderColor(blue, 1, null, 2);
        expect([r, g, b]).toEqual(blue);
    });
});

describe('routeRenderWidth', () => {
    it('widens the selected route the most', () => {
        expect(routeRenderWidth(1, null, 1)).toBeGreaterThan(routeRenderWidth(1, null, null));
    });

    it('widens a hovered route, but less than a selected one', () => {
        const hovered = routeRenderWidth(1, 1, null);
        const selected = routeRenderWidth(1, null, 1);
        const idle = routeRenderWidth(1, null, null);
        expect(hovered).toBeGreaterThan(idle);
        expect(selected).toBeGreaterThan(hovered);
    });
});

describe('stopRadiusPropsFor', () => {
    it('uses pixel units in plane modes, meters in geo', () => {
        expect(stopRadiusPropsFor('plane2d').radiusUnits).toBe('pixels');
        expect(stopRadiusPropsFor('geo').radiusUnits).toBe('meters');
    });
});
