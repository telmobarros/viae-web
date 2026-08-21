/**
 * Click-to-pin selection: click selects, clicking the same thing again
 * unpins, clicking empty space unpins. Phase 5 generalized this from
 * "one node id" to kind-aware selection (node/route/stop/solution), resolved
 * from which LAYER deck.gl reports as hit -- these tests exercise that
 * precedence resolution directly, since it's the part most likely to
 * silently regress into "clicking a stop selects the node underneath it".
 *
 * Exercised through a minimal react-dom harness (no testing-library
 * dependency in this project) rather than by re-implementing the hook's
 * logic as a plain function, since the controlled/uncontrolled split and the
 * toggle-to-unpin behaviour are what's actually worth protecting.
 */
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';

import { useSelection } from '../selection/useSelection';

// React 18's createRoot requires this flag outside of a testing-library
// setup (which sets it internally); without it act() warns even though the
// updates are correctly wrapped.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mountHook(props) {
    let latest;
    function Harness(hookProps) {
        latest = useSelection(hookProps);
        return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(<Harness {...props} />);
    });
    return {
        get current() {
            return latest;
        },
        rerender: (nextProps) => {
            act(() => {
                root.render(<Harness {...nextProps} />);
            });
        },
        unmount: () => {
            act(() => root.unmount());
            container.remove();
        }
    };
}

describe('useSelection: picking precedence by info.layer.id', () => {
    it('resolves a click on the nodes layer to node selection', () => {
        const h = mountHook({});
        act(() => h.current.onClick({ object: { id: 7 }, layer: { id: 'viae-map-nodes' } }));
        expect(h.current.selection).toEqual({ kind: 'node', nodeId: 7 });
        h.unmount();
    });

    it('resolves a click on the routes layer to route selection, reading the embedded route back-reference', () => {
        const h = mountHook({});
        const route = { id: 3, solutionId: 9 };
        act(() => h.current.onClick({ object: { route }, layer: { id: 'viae-map-routes' } }));
        expect(h.current.selection).toEqual({ kind: 'route', routeId: 3, solutionId: 9 });
        h.unmount();
    });

    it('resolves a click on the route-stops layer to stop selection -- this is the precedence case: a stop sits on top of its background node at the same pixel, and must win', () => {
        const h = mountHook({});
        const stop = { nodeId: 12, sequence: 4 };
        act(() => h.current.onClick({ object: { stop, routeId: 3, solutionId: 9 }, layer: { id: 'viae-map-route-stops' } }));
        expect(h.current.selection).toEqual({ kind: 'stop', nodeId: 12, sequence: 4, routeId: 3, solutionId: 9 });
        h.unmount();
    });

    it('clears selection on a click that hit no pickable object (background/basemap)', () => {
        const h = mountHook({});
        act(() => h.current.onClick({ object: { id: 7 }, layer: { id: 'viae-map-nodes' } }));
        act(() => h.current.onClick({ object: null }));
        expect(h.current.selection).toBeNull();
        h.unmount();
    });

    it('clears selection for a hit on an unrecognized layer rather than guessing', () => {
        const h = mountHook({});
        act(() => h.current.onClick({ object: { id: 7 }, layer: { id: 'viae-map-nodes' } }));
        act(() => h.current.onClick({ object: { foo: 1 }, layer: { id: 'viae-map-basemap' } }));
        expect(h.current.selection).toBeNull();
        h.unmount();
    });
});

describe('useSelection: toggle-to-unpin', () => {
    it('unpins when clicking the already-selected node again', () => {
        const h = mountHook({});
        const info = { object: { id: 7 }, layer: { id: 'viae-map-nodes' } };
        act(() => h.current.onClick(info));
        act(() => h.current.onClick(info));
        expect(h.current.selection).toBeNull();
        h.unmount();
    });

    it('does NOT treat a different stop on the SAME route as the same selection', () => {
        const h = mountHook({});
        act(() =>
            h.current.onClick({
                object: { stop: { nodeId: 1, sequence: 0 }, routeId: 3, solutionId: 9 },
                layer: { id: 'viae-map-route-stops' }
            })
        );
        act(() =>
            h.current.onClick({
                object: { stop: { nodeId: 2, sequence: 1 }, routeId: 3, solutionId: 9 },
                layer: { id: 'viae-map-route-stops' }
            })
        );
        expect(h.current.selection).toEqual({ kind: 'stop', nodeId: 2, sequence: 1, routeId: 3, solutionId: 9 });
        h.unmount();
    });

    it('does NOT treat the same route id in a DIFFERENT solution as the same selection', () => {
        // Route ids are only unique within one solution's own routes array;
        // this is exactly the cross-solution collision routeKey()/solutionId
        // exist to prevent.
        const h = mountHook({});
        act(() => h.current.onClick({ object: { route: { id: 1, solutionId: 'A' } }, layer: { id: 'viae-map-routes' } }));
        act(() => h.current.onClick({ object: { route: { id: 1, solutionId: 'B' } }, layer: { id: 'viae-map-routes' } }));
        expect(h.current.selection).toEqual({ kind: 'route', routeId: 1, solutionId: 'B' });
        h.unmount();
    });
});

describe('useSelection: imperative selectors', () => {
    it('selectRoute/selectStop/selectNode/selectSolution set the expected shape', () => {
        const h = mountHook({});
        act(() => h.current.selectSolution(5));
        expect(h.current.selection).toEqual({ kind: 'solution', solutionId: 5 });

        act(() => h.current.selectRoute({ id: 2, solutionId: 5 }));
        expect(h.current.selection).toEqual({ kind: 'route', routeId: 2, solutionId: 5 });

        act(() => h.current.clear());
        expect(h.current.selection).toBeNull();
        h.unmount();
    });
});

describe('useSelection: controlled mode', () => {
    it('reflects the controlled `selection` prop rather than internal state', () => {
        const h = mountHook({ selection: { kind: 'node', nodeId: 3 } });
        expect(h.current.selection).toEqual({ kind: 'node', nodeId: 3 });
        h.unmount();
    });

    it('calls onChange instead of mutating its own state when controlled', () => {
        const onChange = jest.fn();
        const h = mountHook({ selection: { kind: 'node', nodeId: 3 }, onChange });
        act(() => h.current.onClick({ object: { id: 5 }, layer: { id: 'viae-map-nodes' } }));
        expect(onChange).toHaveBeenCalledWith({ kind: 'node', nodeId: 5 });
        // Still reflects the prop (unchanged by the caller in this test).
        expect(h.current.selection).toEqual({ kind: 'node', nodeId: 3 });
        h.unmount();
    });
});
