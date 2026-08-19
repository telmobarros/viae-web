/**
 * Render-budget helpers.
 *
 * Moved verbatim (behaviour unchanged) from
 * `views/dashboard/Default/NodeMapWidget.js`, where they were written for the
 * dashboard node map and then had no way to be reused by any other visualizer.
 * They are the only scale-aware code in the frontend today, so they become
 * shared infrastructure rather than staying private to one widget.
 */

/**
 * Min/max of a numeric array.
 *
 * Deliberately a loop rather than `Math.min(...values)`: spreading blows the
 * argument limit (and the stack) somewhere around 1e5 elements, which is
 * exactly the tier this component targets. Do not "simplify" this.
 */
export function extent(values) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < values.length; i += 1) {
        const v = values[i];
        if (v < min) min = v;
        if (v > max) max = v;
    }
    return min <= max ? [min, max] : [0, 1];
}

/** Pad a degenerate domain so a scale doesn't collapse every point onto one pixel. */
export function padDomain([min, max]) {
    return min === max ? [min - 1, max + 1] : [min, max];
}

/**
 * Cap a node list to `max`, keeping every depot and evenly striding over the
 * rest. Deterministic, so the picture is stable across re-renders.
 *
 * IMPORTANT (route integrity): this is only safe for *background* geometry.
 * Route stops carry no coordinates of their own -- the renderer resolves them
 * through the node index -- so sampling away a node referenced by a rendered
 * route breaks that route's path mid-way. Use `capBackgroundNodes` below when
 * routes are on screen.
 */
export function capNodes(nodes, max) {
    if (nodes.length <= max) return nodes;
    const depots = nodes.filter((n) => n.isDepot ?? n.kind === 'depot');
    if (depots.length >= max) return depots.slice(0, max);
    const rest = nodes.filter((n) => !(n.isDepot ?? n.kind === 'depot'));
    const room = max - depots.length;
    const step = rest.length / room;
    const sampled = new Array(room);
    for (let i = 0; i < room; i += 1) sampled[i] = rest[Math.floor(i * step)];
    return depots.concat(sampled);
}

/**
 * Route-preserving budget.
 *
 * Priority: depots -> stations -> every node referenced by a rendered route
 * -> whatever budget remains for background nodes (evenly strided).
 *
 * `protectedIds` is the set of node ids that must survive regardless of
 * budget. If the protected set alone already exceeds `max`, it is returned
 * whole and the budget is treated as advisory -- a broken route is a
 * correctness bug, an over-budget render is a performance problem, and the
 * former is worse.
 */
export function capBackgroundNodes(nodes, max, protectedIds) {
    const isProtected = (n) =>
        (protectedIds && protectedIds.has(n.id)) || n.isDepot || n.kind === 'depot' || n.isStation || n.kind === 'station';

    const mustKeep = nodes.filter(isProtected);
    if (mustKeep.length >= max) return mustKeep;

    const rest = nodes.filter((n) => !isProtected(n));
    const room = max - mustKeep.length;
    if (rest.length <= room) return mustKeep.concat(rest);

    const step = rest.length / room;
    const sampled = new Array(room);
    for (let i = 0; i < room; i += 1) sampled[i] = rest[Math.floor(i * step)];
    return mustKeep.concat(sampled);
}

/** Node ids referenced by any stop of the given routes -- the protected set. */
export function routeNodeIds(routes) {
    const ids = new Set();
    (routes || []).forEach((r) => {
        (r.stops || []).forEach((s) => {
            const id = s.nodeId ?? s.node_id;
            if (id !== undefined && id !== null) ids.add(id);
        });
    });
    return ids;
}

/** Bounding box [minX, minY, maxX, maxY] over `pos` arrays. */
export function bboxOf(positions) {
    if (!positions || !positions.length) return [0, 0, 1, 1];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < positions.length; i += 1) {
        const p = positions[i];
        if (!p) continue;
        const x = p[0];
        const y = p[1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    if (minX > maxX || minY > maxY) return [0, 0, 1, 1];
    const [px0, px1] = padDomain([minX, maxX]);
    const [py0, py1] = padDomain([minY, maxY]);
    return [px0, py0, px1, py1];
}
