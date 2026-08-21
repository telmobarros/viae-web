/**
 * Route stop markers: one batched ScatterplotLayer over every visible
 * route's resolvable stops, colored by the owning route.
 *
 * Deliberately drawn ABOVE both the background nodes layer and the routes
 * (path) layer in ViaeMap's layer order -- that is the picking-precedence
 * decision (Phase 5 requirement: define precedence intentionally). A stop
 * and its underlying background node occupy the same pixel; whichever layer
 * is topmost wins deck.gl's single-hit picking, so stops must be drawn last
 * to make "click a stop" resolve to stop context rather than node context.
 *
 * Coordinate-less stops (`stop.pos` is undefined -- see adapters/index.js)
 * are excluded from `data` entirely rather than plotted at a fallback
 * position: there is no honest position to draw them at.
 *
 * No per-layer onHover/onClick -- see nodesLayer.js's docstring for why
 * picking is wired at the <DeckGL> level instead.
 */
import { ScatterplotLayer } from '@deck.gl/layers';

import { withAlpha } from '../palette';
import { stopRadiusPropsFor } from './routeStyle';

const BASE_ALPHA = 220;
const ACTIVE_ALPHA = 255;

/**
 * @param {Object} params
 * @param {import('../model').VRoute[]} params.routes
 * @param {'geo'|'plane2d'|'plane3d'} params.spaceMode
 * @param {Set<string>} [params.visibleKeys] routeKey(solutionId, routeId) set; all visible if omitted
 * @param {{routeId, nodeId}|null} [params.hoveredStop]
 * @param {{routeId, nodeId}|null} [params.selectedStop]
 */
export function buildRouteStopsLayer({ routes, spaceMode, visibleKeys, hoveredStop = null, selectedStop = null }) {
    const rows = [];
    (routes || []).forEach((r) => {
        if (visibleKeys && !visibleKeys.has(`${r.solutionId}:${r.id}`)) return;
        (r.stops || []).forEach((s) => {
            if (!s.pos) return;
            rows.push({ routeId: r.id, solutionId: r.solutionId, routeLabel: r.label, stop: s, pos: s.pos, color: r.color });
        });
    });

    const isActive = (d, active) => active && active.routeId === d.routeId && active.nodeId === d.stop.nodeId;

    return new ScatterplotLayer({
        id: 'viae-map-route-stops',
        data: rows,
        pickable: true,
        ...stopRadiusPropsFor(spaceMode),
        stroked: true,
        lineWidthMinPixels: 1,
        getLineColor: [255, 255, 255, 180],
        getPosition: (d) => d.pos,
        getFillColor: (d) => withAlpha(d.color, isActive(d, hoveredStop) || isActive(d, selectedStop) ? ACTIVE_ALPHA : BASE_ALPHA),
        updateTriggers: {
            getFillColor: [hoveredStop, selectedStop]
        }
    });
}
