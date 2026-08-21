/**
 * Adapter tests, focused on THE invariant: `pos` is always [X, Y] in deck.gl
 * world order, whatever dialect the backend used.
 *
 * The euclidean-live case is the important one -- it is the exact shape that
 * shipped transposed once already.
 */
import { fromInstanceNodes, fromLiveSnapshot, fromSimulationSession, fromVisualizerPayload } from '../adapters';

describe('fromInstanceNodes', () => {
    it('swaps lat-first payload order into [lng, lat] for geographic', () => {
        const scene = fromInstanceNodes({
            coordinates: 'lat_lng',
            has_z: false,
            nodes: { 1: { id: 1, isDepot: true, lat: 40.2, lng: -8.6 } },
            total: 1,
            count: 1,
            truncated: false
        });
        expect(scene.space).toEqual({ kind: 'geo', dims: 2 });
        expect(scene.nodes[0].pos).toEqual([-8.6, 40.2]); // NOT [40.2, -8.6]
    });

    it('keeps [x, y] order for Cartesian', () => {
        const scene = fromInstanceNodes({
            coordinates: 'euclidean',
            has_z: false,
            nodes: { 1: { id: 1, x: 3, y: 4 } }
        });
        expect(scene.space).toEqual({ kind: 'plane', dims: 2 });
        expect(scene.nodes[0].pos).toEqual([3, 4]);
    });

    it('carries z when the instance is 3D', () => {
        const scene = fromInstanceNodes({
            coordinates: 'euclidean',
            has_z: true,
            nodes: { 1: { id: 1, x: 3, y: 4, z: 5 } }
        });
        expect(scene.space.dims).toBe(3);
        expect(scene.nodes[0].pos).toEqual([3, 4, 5]);
    });

    it('honours the server label instead of sniffing node fields', () => {
        // Node carries x/y but the server says geographic -> the node cannot
        // be placed on a geo plane and must be dropped, not silently re-read.
        const scene = fromInstanceNodes({
            coordinates: 'lat_lng',
            nodes: { 1: { id: 1, x: 3, y: 4 } }
        });
        expect(scene.nodes).toHaveLength(0);
        expect(scene.budget.skippedNoCoords).toBe(1);
    });

    it('drops coordinate-less nodes rather than emitting undefined positions', () => {
        const scene = fromInstanceNodes({
            coordinates: 'euclidean',
            nodes: { 1: { id: 1, x: 1, y: 2 }, 2: { id: 2 } }
        });
        expect(scene.nodes).toHaveLength(1);
        expect(scene.budget.skippedNoCoords).toBe(1);
    });

    it('reports server-side budget metadata', () => {
        const scene = fromInstanceNodes({
            coordinates: 'euclidean',
            nodes: { 1: { id: 1, x: 1, y: 2 } },
            total: 3611299,
            count: 1,
            truncated: true
        });
        expect(scene.budget.total).toBe(3611299);
        expect(scene.budget.truncated).toBe(true);
        expect(scene.budget.source).toBe('server');
    });

    it('surfaces the sampling strategy the server used for the background tier', () => {
        // 'grid' is the representative spatial sampling (node_sampling.py);
        // this is the field the UI needs to explain the truncation chip
        // honestly rather than implying an arbitrary/id-ordered cut.
        const scene = fromInstanceNodes({
            coordinates: 'lat_lng',
            nodes: { 1: { id: 1, lat: 1, lng: 2 } },
            total: 2744443,
            truncated: true,
            sampling: 'grid'
        });
        expect(scene.budget.sampling).toBe('grid');
    });

    it('surfaces instance-level mixed-space diagnostics', () => {
        const scene = fromInstanceNodes({
            coordinates: 'lat_lng',
            nodes: { 1: { id: 1, lat: 1, lng: 2 } },
            diagnostics: { geographic_nodes: 1, cartesian_nodes: 1, nodes_without_coordinates: 0, mixed_spatial_representation: true }
        });
        expect(scene.diagnostics.mixed_spatial_representation).toBe(true);
    });
});

describe('fromLiveSnapshot', () => {
    const liveSnapshot = (system, coords) => ({
        routes: [
            {
                id: 7,
                label: 'Route 7',
                stops: [
                    { nodeId: 1, sequence: 0, coords: { ...coords[0], system }, metrics: { arrivalTime: 0 } },
                    { nodeId: 2, sequence: 1, coords: { ...coords[1], system }, metrics: { arrivalTime: 10 } }
                ],
                vehicles: [{ current: { position: { lat: coords[0].lat, lng: coords[0].lng }, provenance: 'SIMULATION' } }],
                observedPath: []
            }
        ]
    });

    it('swaps to [lng, lat] for geodesic stops', () => {
        const scene = fromLiveSnapshot(
            liveSnapshot('geodesic', [
                { lat: 40.2, lng: -8.6 },
                { lat: 41.0, lng: -8.0 }
            ])
        );
        expect(scene.space.kind).toBe('geo');
        expect(scene.nodes[0].pos).toEqual([-8.6, 40.2]);
    });

    it('does NOT swap for euclidean stops, because lat holds cx and lng holds cy', () => {
        // app/live.py writes coords[0]->lat, coords[1]->lng, and
        // Node.get_coordinates() returns (cx, cy) for Cartesian. So lat=cx=3,
        // lng=cy=4, and the correct world position is [3, 4] -- NOT [4, 3].
        const scene = fromLiveSnapshot(
            liveSnapshot('euclidean', [
                { lat: 3, lng: 4 },
                { lat: 30, lng: 40 }
            ])
        );
        expect(scene.space.kind).toBe('plane');
        expect(scene.nodes[0].pos).toEqual([3, 4]);
        expect(scene.nodes[1].pos).toEqual([30, 40]);
    });

    it('applies the same rule to live vehicle positions', () => {
        const scene = fromLiveSnapshot(
            liveSnapshot('euclidean', [
                { lat: 3, lng: 4 },
                { lat: 30, lng: 40 }
            ])
        );
        expect(scene.live.vehicles[0].pos).toEqual([3, 4]);
    });

    it('flags a snapshot that mixed coordinate systems instead of silently picking one', () => {
        const snapshot = {
            routes: [
                {
                    id: 1,
                    stops: [
                        { nodeId: 1, sequence: 0, coords: { lat: 40, lng: -8, system: 'geodesic' } },
                        { nodeId: 2, sequence: 1, coords: { lat: 3, lng: 4, system: 'euclidean' } }
                    ]
                }
            ]
        };
        const scene = fromLiveSnapshot(snapshot);
        expect(scene.source.mixedSpace).toBe(true);
    });

    it('builds route geometry as a single segment in stop-sequence order', () => {
        const scene = fromLiveSnapshot(
            liveSnapshot('euclidean', [
                { lat: 3, lng: 4 },
                { lat: 30, lng: 40 }
            ])
        );
        expect(scene.solutions[0].routes[0].segments).toEqual([
            [
                [3, 4],
                [30, 40]
            ]
        ]);
    });

    it('splits into segments around a stop with unresolvable coords, rather than inventing a line across it', () => {
        const snapshot = {
            routes: [
                {
                    id: 1,
                    stops: [
                        { nodeId: 1, sequence: 0, coords: { lat: 3, lng: 4, system: 'euclidean' } },
                        { nodeId: 2, sequence: 1, coords: null },
                        { nodeId: 3, sequence: 2, coords: { lat: 30, lng: 40, system: 'euclidean' } }
                    ]
                }
            ]
        };
        const scene = fromLiveSnapshot(snapshot);
        expect(scene.solutions[0].routes[0].segments).toEqual([[[3, 4]], [[30, 40]]]);
        expect(scene.solutions[0].routes[0].missingCoordinates).toBe(1);
    });
});

describe('fromVisualizerPayload', () => {
    const payload = {
        instance: {
            coordinates: 'euclidean',
            nodes: {
                1: { id: 1, isDepot: true, x: 0, y: 0 },
                2: { id: 2, x: 10, y: 0 },
                3: { id: 3, x: 20, y: 0 }
            },
            links: [{ source: 1, target: 2, directed: true }]
        },
        solutions: {
            5: {
                id: 5,
                distance: 40,
                missed_customers: 2,
                routes: [
                    {
                        id: 50,
                        vehicle_id: 9,
                        distance: 40,
                        stops: [
                            { node_id: 1, sequence: 0, arrival_time: 0, time_window_violation: 0 },
                            { node_id: 2, sequence: 1, arrival_time: 10, time_window_violation: 3 },
                            { node_id: 1, sequence: 2, arrival_time: 20, time_window_violation: 0 }
                        ]
                    }
                ]
            }
        }
    };

    it('resolves route geometry through the node index as a single segment when nothing is missing', () => {
        const scene = fromVisualizerPayload(payload);
        expect(scene.solutions[0].routes[0].segments).toEqual([
            [
                [0, 0],
                [10, 0],
                [0, 0]
            ]
        ]);
        expect(scene.solutions[0].routes[0].missingNodes).toBe(0);
    });

    it('tags each route with its parent solutionId', () => {
        const scene = fromVisualizerPayload(payload);
        expect(scene.solutions[0].routes[0].solutionId).toBe(5);
    });

    it('canonicalizes snake_case stop metrics to camelCase spec keys', () => {
        const scene = fromVisualizerPayload(payload);
        const stop = scene.solutions[0].routes[0].stops[1];
        expect(stop.metrics.arrivalTime).toBe(10);
        expect(stop.metrics.timeWindowViolation).toBe(3);
    });

    it('splits a route into contiguous segments around a coordinate-less stop, rather than inventing a line across the gap', () => {
        // The exact scenario from the Phase 5 requirement: route A(1)->B(2)->A(1)
        // where node 2 is present in the payload but genuinely coordinate-less
        // (no x/y at all -- e.g. a real ASAE record with no geocode). Must
        // render as two one-point segments, never as a stitched [A, A] line
        // that quietly drops the visit to B.
        const withGap = JSON.parse(JSON.stringify(payload));
        withGap.instance.nodes[2] = { id: 2 }; // present, but no x/y
        const scene = fromVisualizerPayload(withGap);
        const route = scene.solutions[0].routes[0];
        expect(route.segments).toEqual([[[0, 0]], [[0, 0]]]);
        expect(route.missingCoordinates).toBe(1);
        expect(route.missingFromPayload).toBe(0);
        expect(route.missingNodes).toBe(1);
    });

    it('distinguishes a node absent from the payload entirely (budget bug) from a coordinate-less node (expected)', () => {
        // Here node 2 is not in `instance.nodes` at all -- simulating the
        // route-preserving budget invariant being violated upstream. This
        // must be counted separately (missingFromPayload) from a genuinely
        // coordinate-less node, since one is a data property and the other
        // is a bug assertScene.js should flag.
        const broken = JSON.parse(JSON.stringify(payload));
        delete broken.instance.nodes[2];
        const scene = fromVisualizerPayload(broken);
        const route = scene.solutions[0].routes[0];
        expect(route.missingFromPayload).toBe(1);
        expect(route.missingCoordinates).toBe(0);
        expect(route.missingNodes).toBe(1);
    });

    it('surfaces the unserved count without requiring geometry', () => {
        const scene = fromVisualizerPayload(payload);
        expect(scene.solutions[0].unserved.count).toBe(2);
        expect(scene.solutions[0].unserved.ids).toBeNull();
    });

    it('falls back to NONE for an empty array when the server sends no links_status (older payload shape)', () => {
        const noLinks = { ...payload, instance: { ...payload.instance, links: [] } };
        expect(fromVisualizerPayload(noLinks).links.status).toBe('none');
    });

    it('trusts the server-reported links_status instead of re-deriving it from array length', () => {
        // load_links() (visualizer_payload.py) now distinguishes ok/none/
        // truncated/error explicitly. An ERROR status with items:[] must NOT
        // be reported as NONE -- that would tell the UI "no links exist" when
        // loading actually failed.
        const errored = {
            ...payload,
            instance: { ...payload.instance, links: [], links_status: 'error', links_error: 'link table unreadable' }
        };
        const scene = fromVisualizerPayload(errored);
        expect(scene.links.status).toBe('error');
        expect(scene.links.error).toBe('link table unreadable');
    });

    it('reports truncation and totals from the server rather than the returned array length', () => {
        const truncated = {
            ...payload,
            instance: { ...payload.instance, links_status: 'truncated', links_total: 50000, links_returned: 1, links_truncated: true }
        };
        const scene = fromVisualizerPayload(truncated);
        expect(scene.links.status).toBe('truncated');
        expect(scene.links.total).toBe(50000);
        expect(scene.links.truncated).toBe(true);
    });

    it('surfaces instance-level mixed-space diagnostics', () => {
        const mixed = {
            ...payload,
            instance: {
                ...payload.instance,
                diagnostics: { geographic_nodes: 2, cartesian_nodes: 3, nodes_without_coordinates: 0, mixed_spatial_representation: true }
            }
        };
        expect(fromVisualizerPayload(mixed).diagnostics.mixed_spatial_representation).toBe(true);
    });

    it('reads has_z from the server field rather than only sniffing a node', () => {
        const flat3d = {
            ...payload,
            instance: { ...payload.instance, has_z: true } // no node actually carries z in this fixture
        };
        expect(fromVisualizerPayload(flat3d).space.dims).toBe(3);
    });
});

describe('fromSimulationSession', () => {
    const session = { progress: { vehicles: [{ routeId: 1, position: { lat: 3, lng: 4 }, status: 'TRAVELLING' }] } };

    it('requires an explicit space because the payload cannot describe itself', () => {
        expect(fromSimulationSession(session, null)).toBeNull();
    });

    it('treats lat/lng as cx/cy when the caller says the scene is Cartesian', () => {
        const overlay = fromSimulationSession(session, { kind: 'plane', dims: 2 });
        expect(overlay.vehicles[0].pos).toEqual([3, 4]);
    });

    it('swaps to [lng, lat] when the caller says the scene is geographic', () => {
        const overlay = fromSimulationSession(session, { kind: 'geo', dims: 2 });
        expect(overlay.vehicles[0].pos).toEqual([4, 3]);
    });
});
