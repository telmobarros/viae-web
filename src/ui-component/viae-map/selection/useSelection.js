/**
 * Click-to-pin selection, generalized in Phase 5 from "one node id" (Phase 3)
 * to a kind-aware selection covering nodes, routes and stops.
 *
 * Selection kind is resolved from `info.layer.id` -- the layer deck.gl
 * reports as actually hit -- never from the shape of `info.object`. That is
 * the intentional picking-precedence decision: which layer is drawn on top
 * (see ViaeMap.jsx's layer order) decides what a coincident click resolves
 * to, and reading it from `info.layer.id` here makes that decision explicit
 * and testable rather than an accident of which fields happen to be present
 * on the picked object.
 *
 * Meant to be wired to <DeckGL onClick>, not per-layer onClick handlers --
 * see layers/nodesLayer.js's docstring for why.
 */
import { useCallback, useState } from 'react';

import { PickKind } from '../model';

function sameSelection(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    switch (a.kind) {
        case PickKind.STOP:
            return a.solutionId === b.solutionId && a.routeId === b.routeId && a.nodeId === b.nodeId;
        case PickKind.ROUTE:
            return a.solutionId === b.solutionId && a.routeId === b.routeId;
        case PickKind.NODE:
            return a.nodeId === b.nodeId;
        case PickKind.SOLUTION:
            return a.solutionId === b.solutionId;
        default:
            return false;
    }
}

/**
 * @param {{selection?: Object|null, onChange?: (s: Object|null) => void}} [params]
 */
export function useSelection({ selection, onChange } = {}) {
    const controlled = selection !== undefined;
    const [internal, setInternal] = useState(null);
    const current = controlled ? selection : internal;

    const setSelection = useCallback(
        (next) => {
            if (onChange) onChange(next);
            if (!controlled) setInternal(next);
        },
        [controlled, onChange]
    );

    // Clicking the already-selected thing again unpins it (toggle), matching
    // Phase 3's node-only behaviour, generalized to every selectable kind.
    const toggle = useCallback((next) => setSelection(sameSelection(current, next) ? null : next), [current, setSelection]);

    const selectNode = useCallback((node) => toggle(node ? { kind: PickKind.NODE, nodeId: node.id } : null), [toggle]);
    const selectRoute = useCallback(
        (route) => toggle(route ? { kind: PickKind.ROUTE, routeId: route.id, solutionId: route.solutionId } : null),
        [toggle]
    );
    const selectStop = useCallback(
        (stop, routeId, solutionId) =>
            toggle(stop ? { kind: PickKind.STOP, nodeId: stop.nodeId, sequence: stop.sequence, routeId, solutionId } : null),
        [toggle]
    );
    const selectSolution = useCallback(
        (solutionId) => toggle(solutionId != null ? { kind: PickKind.SOLUTION, solutionId } : null),
        [toggle]
    );
    const clear = useCallback(() => setSelection(null), [setSelection]);

    const onClick = useCallback(
        (info) => {
            const layerId = info && info.layer && info.layer.id;
            if (!info || !info.object) {
                clear();
                return;
            }
            if (layerId === 'viae-map-route-stops') selectStop(info.object.stop, info.object.routeId, info.object.solutionId);
            else if (layerId === 'viae-map-routes') selectRoute(info.object.route);
            else if (layerId === 'viae-map-nodes') selectNode(info.object);
            else clear();
        },
        [clear, selectStop, selectRoute, selectNode]
    );

    return { selection: current, onClick, clear, selectNode, selectRoute, selectStop, selectSolution };
}
