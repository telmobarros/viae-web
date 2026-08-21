/**
 * Batched route-path layer: ONE PathLayer for every visible route of every
 * visible solution, rather than one layer per route -- explicit Phase 5
 * requirement, and the same batching discipline nodesLayer.js already
 * follows for background nodes.
 *
 * Each row is one CONTIGUOUS SEGMENT (see scale/geometry.js), not one route
 * -- a route broken by a coordinate-less stop contributes multiple rows
 * instead of one row with an invented straight line across the gap. This is
 * transparent to the "one layer" batching: more rows, still one layer.
 *
 * No per-layer onHover/onClick -- see nodesLayer.js's docstring for why
 * picking is wired at the <DeckGL> level instead.
 */
import { PathLayer } from '@deck.gl/layers';

import { routeRenderColor, routeRenderWidth } from './routeStyle';

/**
 * @param {Object} params
 * @param {import('../model').VRoute[]} params.routes
 * @param {Set<string>} [params.visibleKeys] routeKey(solutionId, routeId) set; all visible if omitted
 * @param {number|string|null} [params.hoveredRouteId]
 * @param {number|string|null} [params.selectedRouteId]
 */
export function buildRoutesLayer({ routes, visibleKeys, hoveredRouteId = null, selectedRouteId = null }) {
    const rows = [];
    (routes || []).forEach((r) => {
        if (visibleKeys && !visibleKeys.has(`${r.solutionId}:${r.id}`)) return;
        (r.segments || []).forEach((segment, segmentIndex) => {
            if (segment.length < 2) return; // a lone point has no line to draw
            rows.push({ routeId: r.id, solutionId: r.solutionId, segmentIndex, color: r.color, path: segment, route: r });
        });
    });

    return new PathLayer({
        id: 'viae-map-routes',
        data: rows,
        pickable: true,
        widthUnits: 'pixels',
        widthMinPixels: 1,
        getPath: (d) => d.path,
        getWidth: (d) => routeRenderWidth(d.routeId, hoveredRouteId, selectedRouteId),
        getColor: (d) => routeRenderColor(d.color, d.routeId, hoveredRouteId, selectedRouteId),
        updateTriggers: {
            getWidth: [hoveredRouteId, selectedRouteId],
            getColor: [hoveredRouteId, selectedRouteId]
        }
    });
}
