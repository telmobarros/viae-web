/**
 * Backend payload -> canonical Scene adapters.
 *
 * This module is the ONLY place allowed to know about the backend's
 * coordinate dialects. See ../model.js for the `pos` invariant.
 *
 * Dialect map (verified against the Flask backend):
 *
 *  | endpoint                                   | mode field / values             | coord keys        | z  |
 *  |--------------------------------------------|---------------------------------|-------------------|----|
 *  | /api/v1/dataset_instances/<pk>/nodes        | coordinates: lat_lng|euclidean  | lat/lng AND x/y/z | y  |
 *  | /api/v1/solver_executions/visualizer/<id>   | coordinates: lat_lng|euclidean  | lat/lng or x/y    | n  |
 *  | /api/v1/visualizer/solutions?ids=           | coordinates: lat_lng|euclidean  | lat/lng or x/y    | n  |
 *  | /api/live/routes                            | per-coord system: geodesic|euclidean | ALWAYS lat/lng | y |
 *  | /api/simulation/sessions/<id>               | (none)                          | position.lat/lng  | n  |
 *
 * Three different vocabularies for the same concept, and the last two name
 * their fields `lat`/`lng` even when they hold Cartesian cx/cy.
 */
import { BudgetSource, LinkStatus, canonicalizeMetrics } from '../model';
import { bboxOf, routeNodeIds } from '../scale/budget';
import { routeColor } from '../palette';

const EMPTY_LINKS = { items: [], total: 0, returned: 0, truncated: false, status: LinkStatus.NOT_REQUESTED };

function nodeKind(n) {
    if (n.isDepot) return 'depot';
    if (n.isStation) return 'station';
    return 'customer';
}

function buildIndex(nodes) {
    const m = new Map();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
}

/**
 * Resolve a route's polyline from its stops via the node index.
 *
 * Stops carry no coordinates of their own -- only `node_id` -- so the path is
 * a lookup. A missing node yields a gap rather than a thrown error, but it is
 * a symptom of a route-blind node budget (see capBackgroundNodes) and is
 * reported through `missingNodes` so the UI can surface it honestly instead
 * of silently drawing a wrong line.
 */
function resolvePath(stops, nodeIndex) {
    const path = [];
    let missing = 0;
    stops.forEach((s) => {
        const n = nodeIndex.get(s.nodeId);
        if (n && n.pos) path.push(n.pos);
        else missing += 1;
    });
    return { path, missing };
}

function buildSolutions(rawSolutions, nodeIndex) {
    const list = Array.isArray(rawSolutions) ? rawSolutions : Object.values(rawSolutions || {});
    return list.map((sol, si) => {
        const routes = (sol.routes || []).map((r, ri) => {
            const stops = (r.stops || [])
                .slice()
                .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
                .map((s) => ({
                    nodeId: s.node_id ?? s.nodeId,
                    sequence: s.sequence,
                    pos: (nodeIndex.get(s.node_id ?? s.nodeId) || {}).pos,
                    metrics: canonicalizeMetrics(s, true)
                }));
            const { path, missing } = resolvePath(stops, nodeIndex);
            return {
                id: r.id ?? `${sol.id}-${ri}`,
                label: `R${ri + 1}`,
                color: routeColor(ri),
                vehicleId: r.vehicle_id ?? r.vehicleId,
                driverId: r.driver_id ?? r.driverId,
                metrics: { ...canonicalizeMetrics(r, true), nStops: stops.length },
                stops,
                path,
                missingNodes: missing
            };
        });
        return {
            id: sol.id ?? si,
            label: sol.name || `Solution ${sol.id ?? si}`,
            metrics: canonicalizeMetrics(sol, true),
            routes,
            unserved: {
                count: sol.missed_customers ?? sol.missedCustomers ?? null,
                ids: sol.unserved_node_ids ?? null,
                truncated: Boolean(sol.unserved_truncated)
            }
        };
    });
}

/**
 * `GET /api/v1/dataset_instances/<pk>/nodes` -- the only scale-aware endpoint
 * and the only one that emits z/has_z.
 */
export function fromInstanceNodes(result, meta = {}) {
    if (!result) return null;
    // Honour the server's own label; never sniff node fields. (VRPVisualizer
    // sniffs the first node instead and gets it wrong for mixed payloads.)
    const isGeo = result.coordinates === 'lat_lng';
    const dims = !isGeo && result.has_z ? 3 : 2;

    const raw = Object.values(result.nodes || {});
    const nodes = [];
    let skipped = 0;
    raw.forEach((n) => {
        // Drop nodes that lack the ACTIVE system's keys. The Node CHECK
        // constraint makes a node Cartesian XOR geographic XOR coordinate-less,
        // so a node without the active system's keys is either coordinate-less
        // or evidence of instance-level spatial mixing -- either way it cannot
        // be placed on this scene's plane.
        if (isGeo) {
            if (!Number.isFinite(n.lat) || !Number.isFinite(n.lng)) {
                skipped += 1;
                return;
            }
            nodes.push({ id: n.id, kind: nodeKind(n), pos: [n.lng, n.lat], props: n });
        } else {
            if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
                skipped += 1;
                return;
            }
            nodes.push({ id: n.id, kind: nodeKind(n), pos: dims === 3 ? [n.x, n.y, n.z ?? 0] : [n.x, n.y], props: n });
        }
    });

    return {
        space: { kind: isGeo ? 'geo' : 'plane', dims },
        bbox: bboxOf(nodes.map((n) => n.pos)),
        nodes,
        nodeIndex: buildIndex(nodes),
        links: EMPTY_LINKS,
        solutions: [],
        live: null,
        budget: {
            total: Number.isFinite(result.total) ? result.total : nodes.length,
            returned: nodes.length,
            truncated: Boolean(result.truncated),
            skippedNoCoords: skipped,
            source: BudgetSource.SERVER
        },
        source: { endpoint: meta.endpoint || 'dataset_instances/nodes', fetchedAt: Date.now() }
    };
}

/**
 * `GET /api/v1/solver_executions/visualizer/<id>` and
 * `GET /api/v1/visualizer/solutions?ids=` -- byte-identical payload builders
 * server-side, so one adapter serves both. The only difference is that the
 * former returns exactly one solution.
 */
export function fromVisualizerPayload(result, meta = {}) {
    if (!result) return null;
    const instance = result.instance || {};
    const isGeo = instance.coordinates === 'lat_lng';
    // These endpoints never emit z today (app/views.py:2121 drops cz), so a
    // 3D instance still renders as 2D here until that additive fix lands.
    const dims = !isGeo && Object.values(instance.nodes || {}).some((n) => Number.isFinite(n.z)) ? 3 : 2;

    const raw = Object.values(instance.nodes || {});
    const nodes = [];
    let skipped = 0;
    raw.forEach((n) => {
        if (isGeo) {
            if (!Number.isFinite(n.lat) || !Number.isFinite(n.lng)) {
                skipped += 1;
                return;
            }
            nodes.push({ id: n.id, kind: nodeKind(n), pos: [n.lng, n.lat], props: n });
        } else {
            if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
                skipped += 1;
                return;
            }
            nodes.push({ id: n.id, kind: nodeKind(n), pos: dims === 3 ? [n.x, n.y, n.z ?? 0] : [n.x, n.y], props: n });
        }
    });

    const nodeIndex = buildIndex(nodes);
    const solutions = buildSolutions(result.solutions, nodeIndex);
    const rawLinks = instance.links;

    return {
        space: { kind: isGeo ? 'geo' : 'plane', dims },
        bbox: bboxOf(nodes.map((n) => n.pos)),
        nodes,
        nodeIndex,
        links: rawLinks
            ? {
                  items: rawLinks,
                  total: instance.links_total ?? rawLinks.length,
                  returned: rawLinks.length,
                  truncated: Boolean(instance.links_truncated),
                  // The endpoint currently swallows link-loading errors into
                  // `[]`, so an empty array is genuinely ambiguous until the
                  // additive metadata fix lands. Report NONE, not OK, so the
                  // UI doesn't claim certainty it doesn't have.
                  status: rawLinks.length ? LinkStatus.OK : LinkStatus.NONE
              }
            : EMPTY_LINKS,
        solutions,
        live: null,
        budget: {
            total: instance.total ?? nodes.length,
            returned: nodes.length,
            truncated: Boolean(instance.truncated),
            skippedNoCoords: skipped,
            // No ?limit= on these endpoints yet -- any capping is the client's.
            source: instance.total !== undefined ? BudgetSource.SERVER : BudgetSource.NONE
        },
        source: { endpoint: meta.endpoint || 'visualizer', fetchedAt: Date.now() }
    };
}

/**
 * `GET /api/live/routes` -- THE DANGEROUS ONE.
 *
 * app/live.py:99-119 writes {"lat": coords[0], "lng": coords[1]} on top of
 * Node.get_coordinates(), which returns (cx, cy[, cz]) for Cartesian but
 * (latitude, longitude) for geographic. So for a Euclidean instance the field
 * named `lat` actually holds cx, and `lng` holds cy.
 *
 *   geodesic  -> pos = [c.lng, c.lat]        (keys are honest; swap for deck)
 *   euclidean -> pos = [c.lat, c.lng, c.z]   (cx landed in `lat`)
 *
 * This is LiveRoutes.jsx's `toXY` lifted verbatim; it now lives here so no
 * component ever has to know about it again.
 */
export function fromLiveSnapshot(snapshot, meta = {}) {
    if (!snapshot) return null;
    const routes = snapshot.routes || [];

    // Space comes from the per-coordinate `system` tag. Mixed systems in one
    // snapshot are a server bug, not something to paper over: take the
    // majority and report the conflict rather than silently picking one.
    const counts = { geodesic: 0, euclidean: 0 };
    routes.forEach((r) =>
        (r.stops || []).forEach((s) => {
            const sys = s.coords && s.coords.system;
            if (sys && counts[sys] !== undefined) counts[sys] += 1;
        })
    );
    const isGeo = counts.geodesic >= counts.euclidean && counts.geodesic > 0;
    const mixed = counts.geodesic > 0 && counts.euclidean > 0;
    const hasZ = routes.some((r) => (r.stops || []).some((s) => s.coords && Number.isFinite(s.coords.z)));

    const toPos = (c) => {
        if (!c) return null;
        if (isGeo) return [c.lng, c.lat];
        return hasZ ? [c.lat, c.lng, c.z ?? 0] : [c.lat, c.lng];
    };

    const nodes = [];
    const seen = new Set();
    routes.forEach((r) =>
        (r.stops || []).forEach((s) => {
            const pos = toPos(s.coords);
            if (!pos || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) return;
            if (seen.has(s.nodeId)) return;
            seen.add(s.nodeId);
            nodes.push({ id: s.nodeId, kind: 'customer', pos, props: s });
        })
    );
    const nodeIndex = buildIndex(nodes);

    const vroutes = routes.map((r, ri) => {
        const stops = (r.stops || [])
            .slice()
            .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
            .map((s) => ({
                nodeId: s.nodeId,
                sequence: s.sequence,
                pos: toPos(s.coords),
                // live metrics are already camelCase and a strict subset
                metrics: canonicalizeMetrics(s.metrics, true)
            }));
        return {
            id: r.id,
            label: r.label || `Route ${r.id}`,
            color: routeColor(ri),
            metrics: { nStops: stops.length },
            stops,
            path: stops.map((s) => s.pos).filter(Boolean),
            missingNodes: 0
        };
    });

    const vehicles = [];
    routes.forEach((r) =>
        (r.vehicles || []).forEach((v, vi) => {
            const cur = v.current || v;
            const p = cur.position;
            if (!p) return;
            const pos = isGeo ? [p.lng, p.lat] : [p.lat, p.lng];
            if (!Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) return;
            vehicles.push({
                id: `${r.id}-${vi}`,
                routeId: r.id,
                label: r.label || `Route ${r.id}`,
                pos,
                provenance: cur.provenance || 'GPS',
                recordedAt: cur.recordedAt || null
            });
        })
    );

    const trails = routes
        .map((r) => ({
            id: r.id,
            path: (r.observedPath || [])
                .map((p) => (isGeo ? [p.lng, p.lat] : [p.lat, p.lng]))
                .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
        }))
        .filter((t) => t.path.length > 1);

    return {
        space: { kind: isGeo ? 'geo' : 'plane', dims: !isGeo && hasZ ? 3 : 2 },
        bbox: bboxOf(nodes.map((n) => n.pos)),
        nodes,
        nodeIndex,
        links: EMPTY_LINKS,
        solutions: vroutes.length ? [{ id: 'live', label: 'Live routes', metrics: {}, routes: vroutes, unserved: { count: null, ids: null, truncated: false } }] : [],
        live: { vehicles, trails },
        budget: { total: nodes.length, returned: nodes.length, truncated: false, source: BudgetSource.NONE },
        source: { endpoint: meta.endpoint || 'live/routes', fetchedAt: Date.now(), mixedSpace: mixed }
    };
}

/**
 * `GET /api/simulation/sessions/<id>` vehicle positions.
 *
 * This payload carries NO coordinate-system tag at all (its `position` is
 * {lat,lng} whether the instance is geographic or Cartesian), so it cannot
 * describe itself. `space` must therefore be supplied by the caller -- from
 * the companion live snapshot or the instance record. Once the additive
 * backend fix adds "system" here, this argument becomes a fallback.
 */
export function fromSimulationSession(session, space, meta = {}) {
    if (!session || !space) return null;
    const isGeo = space.kind === 'geo';
    const vehicles = (session.progress && session.progress.vehicles ? session.progress.vehicles : [])
        .map((v) => {
            const p = v.position;
            if (!p) return null;
            const pos = isGeo ? [p.lng, p.lat] : [p.lat, p.lng];
            if (!Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) return null;
            return {
                id: v.routeId,
                routeId: v.routeId,
                label: `Route ${v.routeId}`,
                pos,
                provenance: 'SIMULATION',
                status: v.status,
                legProgress: v.legProgress
            };
        })
        .filter(Boolean);
    return { vehicles, trails: [], source: { endpoint: meta.endpoint || 'simulation/session', fetchedAt: Date.now() } };
}
