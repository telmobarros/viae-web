/**
 * Pure route-geometry helpers, deliberately deck.gl-free (see
 * layers/nodeStyle.js for why that split matters for testability here).
 *
 * The reason this module exists: a route's stops resolve to positions
 * through the node index, and a resolution can fail for two structurally
 * different reasons -- the node genuinely has no coordinates (a legitimate,
 * expected data state), or the node isn't in the payload at all (which
 * should never happen for a routed node given the route-preserving budget
 * invariant, and is a real bug if it does). Either way, a naive
 * `stops.map(resolve).filter(Boolean)` silently invents a straight-line
 * segment across the gap -- A->B->[C missing]->D quietly becomes a drawn
 * A->B->D, which is not the route. `splitIntoSegments` is the fix: it turns
 * a gap into a break between two contiguous, honestly-drawn segments
 * instead of stitching across it.
 */

/**
 * Split a sequence of possibly-null positions into contiguous runs of
 * non-null positions. A null (or run of nulls) ends the current segment;
 * a single-point "segment" is kept (the caller decides whether a 1-point
 * segment is worth rendering as a line).
 *
 * @param {(number[]|null)[]} positions
 * @returns {number[][][]} array of segments, each an array of positions
 */
export function splitIntoSegments(positions) {
    const segments = [];
    let current = [];
    (positions || []).forEach((p) => {
        if (p) {
            current.push(p);
        } else if (current.length) {
            segments.push(current);
            current = [];
        }
    });
    if (current.length) segments.push(current);
    return segments;
}

/** Flatten a route's segments back into one position array, for bbox/fit purposes. */
export function routePositions(route) {
    if (!route || !route.segments) return [];
    return route.segments.flat();
}

/** Flatten every route of a solution into one position array, for bbox/fit purposes. */
export function solutionPositions(solution) {
    if (!solution || !solution.routes) return [];
    return solution.routes.flatMap(routePositions);
}
