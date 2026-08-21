import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';

import { useRouteVisibility } from '../selection/useRouteVisibility';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const routes = [
    { id: 1, solutionId: 'A' },
    { id: 2, solutionId: 'A' }
];

function mountHook(routesArg) {
    let latest;
    function Harness({ r }) {
        latest = useRouteVisibility(r);
        return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Harness r={routesArg} />));
    return {
        get current() {
            return latest;
        },
        unmount: () => {
            act(() => root.unmount());
            container.remove();
        }
    };
}

describe('useRouteVisibility', () => {
    it('defaults to everything visible (null = no filter)', () => {
        const h = mountHook(routes);
        expect(h.current.visibleKeys).toBeNull();
        h.unmount();
    });

    it('toggling one route off produces a Set containing only the other', () => {
        const h = mountHook(routes);
        act(() => h.current.toggle(routes[0]));
        expect(h.current.visibleKeys.has('A:2')).toBe(true);
        expect(h.current.visibleKeys.has('A:1')).toBe(false);
        h.unmount();
    });

    it('toggling the same route twice returns to fully visible (null)', () => {
        const h = mountHook(routes);
        act(() => h.current.toggle(routes[0]));
        act(() => h.current.toggle(routes[0]));
        expect(h.current.visibleKeys).toBeNull();
        h.unmount();
    });

    it('hideAll hides every current route', () => {
        const h = mountHook(routes);
        act(() => h.current.hideAll());
        expect(h.current.visibleKeys.size).toBe(0);
        h.unmount();
    });

    it('showAll returns to fully visible (null) after hideAll', () => {
        const h = mountHook(routes);
        act(() => h.current.hideAll());
        act(() => h.current.showAll());
        expect(h.current.visibleKeys).toBeNull();
        h.unmount();
    });

    it('does not confuse routes with the same id across different solutions', () => {
        const crossSolutionRoutes = [
            { id: 1, solutionId: 'A' },
            { id: 1, solutionId: 'B' }
        ];
        const h = mountHook(crossSolutionRoutes);
        act(() => h.current.toggle(crossSolutionRoutes[0])); // hide A:1 only
        expect(h.current.visibleKeys.has('A:1')).toBe(false);
        expect(h.current.visibleKeys.has('B:1')).toBe(true);
        h.unmount();
    });
});
