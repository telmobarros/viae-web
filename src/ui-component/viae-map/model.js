/**
 * Canonical frontend visualization model.
 *
 * THE ONE INVARIANT
 * -----------------
 *   `pos` is ALWAYS [X, Y] or [X, Y, Z] in deck.gl world order.
 *     space.kind === 'geo'   ->  [longitude, latitude]
 *     space.kind === 'plane' ->  [x, y, z?]
 *
 * Every axis-order hazard lives in an adapter (see ./adapters). Nothing
 * downstream of an adapter may read `lat`, `lng`, `cx` or `cy`.
 *
 * Why this matters concretely: the backend has three different coordinate
 * dialects, and two of them pack Cartesian coordinates into fields *named*
 * lat/lng (app/live.py:109-111 writes cx->lat, cy->lng on top of
 * Node.get_coordinates(), which itself returns (cx,cy) for Cartesian but
 * (latitude,longitude) for geographic -- different axis orders, documented as
 * a hazard at app/models/models.py:122). A naive [lng, lat] read transposes a
 * whole Euclidean instance. That bug has already shipped once.
 *
 * @typedef {{ kind: 'geo'|'plane', dims: 2|3 }} Space
 *
 * @typedef {Object} VNode
 * @property {number|string} id
 * @property {'depot'|'customer'|'station'} kind
 * @property {number[]} pos          // [x,y] or [x,y,z] -- see invariant
 * @property {Object} [props]        // passthrough for tooltips
 *
 * @typedef {Object} VStop
 * @property {number|string} nodeId
 * @property {number} sequence
 * @property {number[]} [pos]        // resolved from the node index; absent if coordinate-less
 * @property {Object} metrics        // canonical METRIC_SPEC keys
 *
 * @typedef {Object} VRoute
 * @property {number|string} id
 * @property {number|string} [solutionId]  // back-reference; needed for cross-solution-safe selection/visibility keys
 * @property {string} label
 * @property {number[]} color        // [r,g,b]
 * @property {number|string} [vehicleId]
 * @property {Object} metrics
 * @property {VStop[]} stops
 * @property {number[][][]} segments // contiguous renderable runs -- see scale/geometry.js.
 *                                   // NEVER stitched across a gap: a coordinate-less or
 *                                   // budget-dropped stop breaks the route into two segments
 *                                   // rather than inventing a straight line across it.
 * @property {number} missingCoordinates  // stops skipped because the node genuinely has no coordinates
 * @property {number} missingFromPayload  // stops skipped because the node wasn't in the payload at all
 *                                        // (should not happen given the route-preserving budget invariant --
 *                                        // a non-zero count here is a real bug, not an expected data state)
 * @property {number} missingNodes   // missingCoordinates + missingFromPayload, for a quick "is this route broken" check
 *
 * @typedef {Object} VSolution
 * @property {number|string} id
 * @property {string} label
 * @property {Object} metrics
 * @property {VRoute[]} routes
 * @property {{count: number|null, ids: Array|null, truncated: boolean}} unserved
 *
 * @typedef {Object} Scene
 * @property {Space} space
 * @property {number[]} bbox                  // [minX,minY,maxX,maxY]
 * @property {VNode[]} nodes
 * @property {Map} nodeIndex                  // id -> VNode
 * @property {Object} links                   // {items,total,returned,truncated,status}
 * @property {VSolution[]} solutions
 * @property {Object|null} live               // {vehicles,trails} or null
 * @property {Object} budget                  // {total,returned,truncated,source,sampling?}
 * @property {Object|null} [diagnostics]       // {geographic_nodes,cartesian_nodes,nodes_without_coordinates,mixed_spatial_representation}
 * @property {Object} source                  // {endpoint,fetchedAt} -- provenance
 */

/** Link availability, so the UI can tell "none exist" from "we failed to load them". */
export const LinkStatus = {
    OK: 'ok',
    NONE: 'none',
    NOT_REQUESTED: 'not_requested',
    TRUNCATED: 'truncated',
    ERROR: 'error'
};

/** Where a budget decision was made. */
export const BudgetSource = {
    SERVER: 'server',
    CLIENT: 'client',
    NONE: 'none'
};

/**
 * What kind of thing is selected/hovered. Read from `info.layer.id` at pick
 * time (see layers/*.js), never inferred from the picked object's shape --
 * that keeps picking precedence an explicit, intentional decision (stops
 * layer drawn above the routes layer drawn above the nodes layer) rather
 * than a guess based on which fields happen to be present.
 */
export const PickKind = {
    NODE: 'node',
    ROUTE: 'route',
    STOP: 'stop',
    SOLUTION: 'solution'
};

/**
 * Composite key for route visibility/selection state. Route ids are only
 * unique WITHIN a solution's own routes array in general (nothing in the
 * backend payload guarantees cross-solution uniqueness), so keying state by
 * bare route id risks one solution's toggle silently applying to another's
 * route of the same id once multiple solutions are in one Scene.
 */
export function routeKey(solutionId, routeId) {
    return `${solutionId}:${routeId}`;
}

/**
 * Metric PRESENTATION registry.
 *
 * This is presentation metadata ONLY -- labels, grouping, formatting. It is
 * deliberately NOT an authoritative statement about which routing metrics
 * exist or are operational; backend/runtime semantics remain canonical. A key
 * being absent from a payload simply means "don't render a row for it".
 *
 * Covers the union of the two backend dialects: the 21 snake_case fields the
 * visualizer endpoints emit (app/views.py:2147-2170) and the 5 camelCase ones
 * /api/live/routes emits (app/live.py:143-155). Adapters translate both onto
 * these canonical keys, which is why the live view gets a correct (sparse)
 * metric panel for free, and why the 8 fields the current D3 visualizer
 * silently drops start rendering.
 */
export const METRIC_GROUPS = [
    { key: 'time', label: 'Time' },
    { key: 'distance', label: 'Distance' },
    { key: 'cost', label: 'Cost' },
    { key: 'load', label: 'Load & capacity' },
    { key: 'value', label: 'Value' },
    { key: 'feasibility', label: 'Feasibility' },
    { key: 'summary', label: 'Summary' }
];

/**
 * Some RouteStop numeric fields (e.g. service_time, waiting_time,
 * arrival/departure_vehicle_cost, arrival/departure_profit,
 * time_window_violation) arrive from the backend as JSON STRINGS, not
 * numbers -- confirmed directly against a real execution payload: `"0E-10"`,
 * `"78.1688098595"`, quoted. Route/Solution-level fields (distance, cost,
 * n_vehicles, ...) do not have this problem; they are plain JSON floats.
 * The likely cause is a SQLAlchemy Numeric/Decimal column being serialized
 * via Python's `str(Decimal(...))` rather than being coerced to float first
 * -- the same class of bug Phase 2 fixed for Node.cx/cy (Float(asdecimal=True)
 * yielding decimal.Decimal), just not on this column family.
 *
 * Without this coercion, `typeof v === 'number'` is false for those fields,
 * so the format functions fell through to `String(v)` and rendered the raw
 * Decimal repr verbatim -- "0E-10" instead of "0.00", full unrounded
 * precision instead of 2dp. `Number()` parses scientific-notation strings
 * correctly (`Number("0E-10") === 0`), so this coercion is enough; it does
 * not require a backend change, and this stays a presentation-layer fix,
 * not a routing-semantics one -- METRIC_SPEC remains display metadata only.
 */
function toNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

const num = (d) => (v) => {
    const n = toNumber(v);
    return n !== null ? n.toFixed(d) : String(v);
};
const int = (v) => {
    const n = toNumber(v);
    return n !== null ? n.toLocaleString() : String(v);
};
const bool = (v) => (v ? 'Yes' : 'No');
const violation = (v) => {
    const n = toNumber(v);
    return n !== null && n > 0 ? 'error' : null;
};

export const METRIC_SPEC = [
    // time
    { key: 'arrivalTime', label: 'Arrival time', group: 'time', format: num(2) },
    { key: 'departureTime', label: 'Departure time', group: 'time', format: num(2) },
    { key: 'serviceTime', label: 'Service time', group: 'time', format: num(2) },
    { key: 'waitingTime', label: 'Waiting time', group: 'time', format: num(2) },
    { key: 'travelTime', label: 'Travel time', group: 'time', format: num(2) },
    { key: 'travelTimeDiff', label: 'Travel time spread', group: 'time', format: num(2) },
    { key: 'customerWaitingTime', label: 'Customer waiting', group: 'time', format: num(2) },
    // distance
    { key: 'distance', label: 'Distance', group: 'distance', format: num(2) },
    { key: 'distanceDiff', label: 'Distance spread', group: 'distance', format: num(2) },
    { key: 'arrivalDistance', label: 'Arrival distance', group: 'distance', format: num(2) },
    { key: 'departureDistance', label: 'Departure distance', group: 'distance', format: num(2) },
    // cost
    { key: 'cost', label: 'Cost', group: 'cost', format: num(2) },
    { key: 'costDiff', label: 'Cost spread', group: 'cost', format: num(2) },
    { key: 'vehicleCost', label: 'Vehicle cost', group: 'cost', format: num(2) },
    { key: 'arrivalCost', label: 'Arrival cost', group: 'cost', format: num(2) },
    { key: 'departureCost', label: 'Departure cost', group: 'cost', format: num(2) },
    { key: 'arrivalVehicleCost', label: 'Arrival vehicle cost', group: 'cost', format: num(2) },
    { key: 'departureVehicleCost', label: 'Departure vehicle cost', group: 'cost', format: num(2) },
    // load & capacity
    { key: 'demand', label: 'Demand', group: 'load', format: num(2) },
    { key: 'load', label: 'Load', group: 'load', format: num(2) },
    { key: 'arrivalLoad', label: 'Arrival load', group: 'load', format: num(2) },
    { key: 'departureLoad', label: 'Departure load', group: 'load', format: num(2) },
    { key: 'arrivalCapacity', label: 'Arrival capacity', group: 'load', format: num(2) },
    { key: 'departureCapacity', label: 'Departure capacity', group: 'load', format: num(2) },
    // value
    { key: 'profit', label: 'Profit', group: 'value', format: num(2) },
    { key: 'arrivalProfit', label: 'Arrival profit', group: 'value', format: num(2) },
    { key: 'departureProfit', label: 'Departure profit', group: 'value', format: num(2) },
    { key: 'quality', label: 'Quality', group: 'value', format: num(3) },
    // feasibility
    { key: 'timeWindowViolation', label: 'TW violation', group: 'feasibility', format: num(2), severity: violation },
    { key: 'timeWindowViolations', label: 'TW violations', group: 'feasibility', format: num(2), severity: violation },
    { key: 'capacityViolations', label: 'Capacity violations', group: 'feasibility', format: num(2), severity: violation },
    { key: 'durationViolations', label: 'Duration violations', group: 'feasibility', format: num(2), severity: violation },
    { key: 'fuelViolations', label: 'Fuel violations', group: 'feasibility', format: num(2), severity: violation },
    { key: 'missedCustomers', label: 'Missed customers', group: 'feasibility', format: int, severity: violation },
    { key: 'feasibility', label: 'Feasible', group: 'feasibility', format: bool },
    // summary
    { key: 'nVehicles', label: 'Vehicles', group: 'summary', format: int },
    { key: 'nCustomers', label: 'Customers', group: 'summary', format: int },
    { key: 'nStops', label: 'Stops', group: 'summary', format: int }
];

const SPEC_BY_KEY = new Map(METRIC_SPEC.map((m) => [m.key, m]));

export function metricSpec(key) {
    return SPEC_BY_KEY.get(key) || null;
}

/**
 * Group a metrics object into renderable sections, preserving METRIC_SPEC
 * order and skipping keys that are absent/null -- the same "render what's
 * there" behaviour the current D3 visualizer has, generalized.
 */
export function groupMetrics(metrics) {
    if (!metrics) return [];
    const byGroup = new Map();
    METRIC_SPEC.forEach((spec) => {
        const value = metrics[spec.key];
        if (value === undefined || value === null) return;
        if (!byGroup.has(spec.group)) byGroup.set(spec.group, []);
        byGroup.get(spec.group).push({
            ...spec,
            value,
            display: spec.format ? spec.format(value) : String(value),
            severity: spec.severity ? spec.severity(value) : null
        });
    });
    return METRIC_GROUPS.filter((g) => byGroup.has(g.key)).map((g) => ({ ...g, items: byGroup.get(g.key) }));
}

/**
 * snake_case -> canonical camelCase key. Used by the visualizer-endpoint
 * adapters; the live adapter's keys are already camelCase and pass through.
 */
export function canonicalMetricKey(key) {
    return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Translate a raw metrics object (either dialect) onto canonical keys. */
export function canonicalizeMetrics(raw, allowlist) {
    if (!raw) return {};
    const out = {};
    Object.keys(raw).forEach((k) => {
        const ck = canonicalMetricKey(k);
        if (allowlist && !SPEC_BY_KEY.has(ck)) return;
        const v = raw[k];
        if (v === undefined || v === null) return;
        out[ck] = v;
    });
    return out;
}
