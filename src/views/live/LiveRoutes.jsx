import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DeckGL from '@deck.gl/react';
import { MapView, OrthographicView } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import {
    Box,
    Button,
    ButtonGroup,
    Chip,
    CircularProgress,
    LinearProgress,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography,
    FormControlLabel
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import StopIcon from '@mui/icons-material/Stop';
import io from 'socket.io-client';

import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const SPEED_OPTIONS = [1, 5, 10, 25, 50, 100];
// Mirrors app.models.simulation_models.EventType (Phase D1) -- generic,
// not ASAE-specific.
const EVENT_TYPE_OPTIONS = [
    'SERVICE_TIME_CHANGE',
    'TRAVEL_TIME_CHANGE',
    'VEHICLE_UNAVAILABLE',
    'SERVICE_INTERRUPTION',
    'REQUEST_CANCELLED',
    'PRIORITY_VALUE_CHANGE',
    'NEW_REQUEST',
    'MANDATORY_REQUEST',
    'VEHICLE_POSITION_UPDATE'
];

// Two view "shapes": geodesic instances (real lat/lng) use deck.gl's Web
// Mercator MapView + a real-world tile basemap; Cartesian/Euclidean instances
// (arbitrary-unit cx/cy, not degrees) use a plain OrthographicView with no
// basemap -- plotting Euclidean coordinates through MapView either lands
// somewhere meaningless on a real-world map or breaks outright once a
// coordinate exceeds valid latitude bounds (|lat| > 90). Which one applies is
// read from the coordinate-`system` tag the backend already computes per
// point (app/live.py:_node_coords) -- see docs/audit/
// LIVE_ROUTE_SIMULATOR_IMPLEMENTATION_REPORT.md's "remaining limitations" for
// the history of this gap.
const defaultGeoView = {
    longitude: -8.6,
    latitude: 40.2,
    zoom: 6,
    pitch: 0,
    bearing: 0
};
const defaultEuclideanView = { target: [0, 0, 0], zoom: 0 };

const LiveRoutes = () => {
    const [searchParams] = useSearchParams();
    const [drivers, setDrivers] = useState([]);
    const [routesData, setRoutesData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewState, setViewState] = useState(defaultGeoView);
    const [viewFitted, setViewFitted] = useState(false);
    const [solutionIds, setSolutionIds] = useState('');
    const [solutionPaths, setSolutionPaths] = useState([]);
    const [solutionPathsEuclidean, setSolutionPathsEuclidean] = useState(false);
    const [showSolution, setShowSolution] = useState(false);
    const socketRef = useRef(null);

    // Coordinate system for the currently-live routes, read from the
    // per-stop `system` tag the backend already computes (app/live.py).
    // Unknown (null) until the first snapshot with at least one stop arrives.
    const coordSystem = useMemo(() => {
        for (const r of routesData) {
            for (const s of r.stops || []) {
                if (s.coords?.system) return s.coords.system;
            }
        }
        return null;
    }, [routesData]);
    const isEuclidean = coordSystem === 'euclidean';

    // -- Simulation control panel (Phase D0: deterministic playback of a
    // planned Solution -- see docs/audit/LIVE_ROUTE_SIMULATOR_IMPLEMENTATION_REPORT.md).
    // Positions arrive through the same /live socket subscription above; this
    // panel only drives the session lifecycle and shows its clock/progress.
    const [simSolutionId, setSimSolutionId] = useState(searchParams.get('solutionId') || '');
    const [simSession, setSimSession] = useState(null);
    const [simError, setSimError] = useState('');
    const [simBusy, setSimBusy] = useState(false);
    const simPollRef = useRef(null);

    const mergeDrivers = (routesPayload = []) => {
        const driverPoints = [];
        routesPayload.forEach((route) => {
            (route.vehicles || []).forEach((veh, idx) => {
                const pos = veh?.current?.position || veh?.position;
                if (!pos) return;
                driverPoints.push({
                    id: `${route.id}-${idx}`,
                    routeId: route.id,
                    label: route.label || `Route ${route.id}`,
                    lat: pos.lat,
                    lng: pos.lng,
                    provenance: veh?.current?.provenance || 'GPS',
                    recordedAt: veh?.current?.recordedAt || null
                });
            });
        });
        setDrivers(driverPoints);
        // View centering/fitting happens once, from the planned stops
        // (below) -- not here on every position update, which would both be
        // jarring during playback and assume the wrong viewState shape once
        // a Euclidean instance is in play (MapView's longitude/latitude
        // fields vs. OrthographicView's target/zoom).
    };

    useEffect(() => {
        const loadSnapshot = async () => {
            try {
                const res = await authAxios.get(`${API_BASE}/api/live/routes`);
                mergeDrivers(res?.data?.routes || []);
                setRoutesData(res?.data?.routes || []);
            } catch (e) {
                console.error('Failed to load live routes snapshot', e);
            } finally {
                setLoading(false);
            }
        };
        loadSnapshot();
    }, []);

    useEffect(() => {
        socketRef.current = io(`${API_BASE}/live`, {
            transports: ['polling', 'websocket'], // allow fallback if websockets are blocked
            path: '/socket.io',
            reconnectionAttempts: 3
        });

        const socket = socketRef.current;
        socket.on('connect', () => {
            socket.emit('join_live', { room: 'routes' });
        });

        socket.on('connect_error', (err) => {
            console.warn('Socket connect_error', err?.message || err);
        });

        socket.on('vehicle_update', (payload) => {
            if (!payload?.routeId || !payload?.position) return;
            setDrivers((prev) => {
                const without = prev.filter((d) => d.routeId !== payload.routeId);
                const updated = {
                    id: `${payload.routeId}`,
                    routeId: payload.routeId,
                    label: `Route ${payload.routeId}`,
                    lat: payload.position.lat,
                    lng: payload.position.lng,
                    provenance: payload.provenance || 'GPS',
                    recordedAt: payload.recordedAt || null
                };
                return [...without, updated];
            });
        });

        socket.on('total_screen_update', (payload) => {
            if (payload?.routes) {
                mergeDrivers(payload.routes);
                setRoutesData(payload.routes);
            }
        });

        return () => {
            socket.emit('leave_live', { room: 'routes' });
            socket.disconnect();
        };
    }, []);

    // Fit the view to the planned stops once, as soon as we know the
    // coordinate system and have at least one stop to frame -- system-aware
    // (MapView vs OrthographicView viewState shapes differ) and one-shot so
    // it doesn't fight with the user panning/zooming during playback.
    useEffect(() => {
        if (viewFitted || coordSystem === null) return;
        const points = routesData.flatMap((r) => (r.stops || []).map((s) => s.coords)).filter(Boolean);
        if (!points.length) return;
        setViewFitted(true);
        if (isEuclidean) {
            // True axis order: `lat` holds cx, `lng` holds cy (see toXY below).
            const xs = points.map((p) => p.lat);
            const ys = points.map((p) => p.lng);
            const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
            const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
            const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
            const zoom = Math.log2(600 / span);
            setViewState({ target: [centerX, centerY, 0], zoom: Number.isFinite(zoom) ? zoom : 0 });
        } else {
            const lats = points.map((p) => p.lat);
            const lngs = points.map((p) => p.lng);
            setViewState({
                ...defaultGeoView,
                latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
                longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coordSystem, routesData, viewFitted]);

    // -- Simulation control panel ---------------------------------------

    useEffect(() => {
        if (simPollRef.current) clearInterval(simPollRef.current);
        if (!simSession?.id) return undefined;
        const poll = async () => {
            try {
                const res = await authAxios.get(`${API_BASE}/api/simulation/sessions/${simSession.id}`);
                setSimSession(res.data);
            } catch (e) {
                console.error('Failed to poll simulation session', e);
            }
        };
        simPollRef.current = setInterval(poll, 1000);
        return () => clearInterval(simPollRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simSession?.id]);

    const runSimAction = async (action) => {
        setSimError('');
        setSimBusy(true);
        try {
            const res = await action();
            setSimSession(res.data);
        } catch (e) {
            setSimError(e?.response?.data?.error || e?.message || 'Simulation action failed');
        } finally {
            setSimBusy(false);
        }
    };

    const createAndStartSimulation = () => {
        if (!simSolutionId) {
            setSimError('Enter a Solution ID first.');
            return;
        }
        runSimAction(async () => {
            const created = await authAxios.post(`${API_BASE}/api/simulation/sessions`, {
                solutionId: Number(simSolutionId),
                speedMultiplier: 1
            });
            return authAxios.post(`${API_BASE}/api/simulation/sessions/${created.data.id}/start`);
        });
    };

    const pauseSimulation = () => runSimAction(() => authAxios.post(`${API_BASE}/api/simulation/sessions/${simSession.id}/pause`));
    const resumeSimulation = () => runSimAction(() => authAxios.post(`${API_BASE}/api/simulation/sessions/${simSession.id}/resume`));
    const resetSimulation = () => runSimAction(() => authAxios.post(`${API_BASE}/api/simulation/sessions/${simSession.id}/reset`));
    const stopSimulation = () => runSimAction(() => authAxios.post(`${API_BASE}/api/simulation/sessions/${simSession.id}/stop`));
    const changeSimSpeed = (multiplier) =>
        runSimAction(() => authAxios.put(`${API_BASE}/api/simulation/sessions/${simSession.id}/speed`, { multiplier }));

    const simStatus = simSession?.status;
    const simProgress = simSession?.progress;
    const simEvents = simSession?.events || [];
    const simProgressPct =
        simProgress && simProgress.totalVisits ? Math.round((100 * simProgress.completedVisits) / simProgress.totalVisits) : 0;

    // -- Event scheduling (Phase D1: RoutingEvent + ExecutionSnapshot -- see
    // docs/audit/DYNAMIC_ROUTING_EVENTS_IMPLEMENTATION_REPORT.md). Development-
    // oriented form: raw event type + optional sim time (blank = inject now)
    // + optional entity reference + optional free-form JSON payload. No
    // "Replan" action here -- D1 stops at classification.
    const [newEventType, setNewEventType] = useState('VEHICLE_UNAVAILABLE');
    const [newEventTime, setNewEventTime] = useState('');
    const [newEventEntityType, setNewEventEntityType] = useState('');
    const [newEventEntityId, setNewEventEntityId] = useState('');
    const [newEventPayload, setNewEventPayload] = useState('');

    const scheduleSimEvent = async () => {
        let payload;
        if (newEventPayload.trim()) {
            try {
                payload = JSON.parse(newEventPayload);
            } catch (e) {
                setSimError('Payload must be valid JSON (or left empty).');
                return;
            }
        }
        setSimError('');
        setSimBusy(true);
        try {
            // Note: this endpoint returns the created RoutingEvent, not the
            // session -- re-fetch the session explicitly (rather than
            // reusing runSimAction, which assumes the action's response IS
            // the session payload) so the timeline below updates immediately
            // instead of waiting for the next 1s poll.
            await authAxios.post(`${API_BASE}/api/simulation/sessions/${simSession.id}/events`, {
                eventType: newEventType,
                scheduledSimTime: newEventTime === '' ? undefined : Number(newEventTime),
                affectedEntityType: newEventEntityType || undefined,
                affectedEntityId: newEventEntityId === '' ? undefined : Number(newEventEntityId),
                payload
            });
            const res = await authAxios.get(`${API_BASE}/api/simulation/sessions/${simSession.id}`);
            setSimSession(res.data);
        } catch (e) {
            setSimError(e?.response?.data?.error || e?.message || 'Failed to schedule event');
        } finally {
            setSimBusy(false);
        }
    };

    const loadSolutionOverlay = async () => {
        const ids = (solutionIds || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (!ids.length) {
            setSolutionPaths([]);
            return;
        }
        try {
            const res = await authAxios.get(`${API_BASE}/api/v1/visualizer/solutions`, { params: { ids: ids.join(',') } });
            const payload = res?.data?.result;
            const nodes = payload?.instance?.nodes || {};
            // 'euclidean' | 'lat_lng' -- views.py's VisualizerAPI.by_solutions
            // already tags this; nodes carry either {x,y} or {lat,lng}, never
            // both (Node's own CheckConstraint), never guess from field presence.
            const overlayIsEuclidean = payload?.instance?.coordinates === 'euclidean';
            const solutions = payload?.solutions || {};
            const paths = [];
            Object.entries(solutions).forEach(([sid, sol]) => {
                sol.routes.forEach((route, idx) => {
                    const path = route.stops
                        .map((stop) => nodes[stop.node_id])
                        .filter(Boolean)
                        // True [x, y] order either way -- no lng/lat axis swap.
                        .map((node) => (overlayIsEuclidean ? [node.x, node.y] : [node.lng, node.lat]))
                        .filter((p) => p[0] !== undefined && p[1] !== undefined);
                    if (path.length > 1) {
                        paths.push({ id: `${sid}-${idx}`, path });
                    }
                });
            });
            setSolutionPaths(paths);
            setSolutionPathsEuclidean(overlayIsEuclidean);
            setShowSolution(true);
        } catch (e) {
            console.error('Failed to load solution overlay', e);
        }
    };

    const layers = useMemo(() => {
        // True [x, y] axis order for either coordinate system -- `lat` holds
        // cx and `lng` holds cy for Euclidean points (app/live.py's generic
        // reuse of the same two field names for both systems), so a plain
        // [lng, lat] read -- correct for geodesic -- would transpose a
        // Euclidean instance's axes. One helper, used everywhere a point is
        // projected, keeps this correct in exactly one place.
        const toXY = (p) => {
            if (!p) return [0, 0];
            return isEuclidean ? [p.lat ?? 0, p.lng ?? 0] : [p.lng ?? 0, p.lat ?? 0];
        };

        // A real-world raster basemap only makes sense for geodesic
        // coordinates -- omit it entirely under OrthographicView.
        const baseMap = isEuclidean
            ? null
            : new TileLayer({
                  id: 'basemap',
                  data: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                  minZoom: 0,
                  maxZoom: 19,
                  tileSize: 256,
                  renderSubLayers: (props) => {
                      const { west, south, east, north } = props.tile.bbox;
                      return new BitmapLayer(props, {
                          data: null,
                          image: props.data,
                          bounds: [west, south, east, north]
                      });
                  }
              });

        const palette = [
            [25, 118, 210],
            [255, 167, 38],
            [76, 175, 80],
            [236, 64, 122],
            [121, 85, 72]
        ];
        const colorForRoute = (id) => palette[id % palette.length].map((c) => Math.min(255, c + 0));

        const plannedLayer = new PathLayer({
            id: 'planned-routes',
            data: routesData.filter((r) => (r.plannedPath || []).length > 1),
            getPath: (r) => (r.plannedPath || []).map(toXY),
            getWidth: 3,
            widthUnits: 'pixels',
            getColor: (r) => [...colorForRoute(r.id), 160],
            rounded: true,
            visible: true
        });

        const observedLayer = new PathLayer({
            id: 'observed-routes',
            data: routesData.filter((r) => (r.observedPath || []).length > 1),
            getPath: (r) => (r.observedPath || []).map(toXY),
            getWidth: 5,
            widthUnits: 'pixels',
            getColor: (r) => [...colorForRoute(r.id), 220],
            rounded: true,
            visible: true
        });

        const stopsLayer = new ScatterplotLayer({
            id: 'stops',
            data: routesData.flatMap((r) =>
                (r.stops || []).map((s) => ({
                    ...s,
                    routeId: r.id
                }))
            ),
            getPosition: (d) => toXY(d.coords),
            getFillColor: [171, 71, 188, 210],
            // Pixel-space, not 'meters' (the ScatterplotLayer default):
            // 'meters' only has real-world meaning for geodesic coordinates
            // projected through MapView -- under OrthographicView (Euclidean
            // instances) it's interpreted as raw coordinate units, so a
            // radius of 80 could dwarf an entire small benchmark instance
            // (e.g. Solomon-style coordinates spanning roughly 0-100) and
            // render as huge overlapping dots. Pixel sizing, matching
            // driverLayer's icon (sizeUnits: 'pixels'), stays a small, fixed
            // on-screen size regardless of coordinate system or zoom.
            radiusUnits: 'pixels',
            getRadius: 6,
            visible: true,
            pickable: true,
            stroked: false
        });

        // Provenance colouring: simulated vehicles (Phase D0 playback) are
        // rendered distinctly from real GPS-observed ones -- same map, same
        // layer, no separate simulation-only view (per design).
        //
        // ScatterplotLayer, not IconLayer: an inline SVG data-URI icon
        // (tried first) still wasn't visible in live testing, which means
        // *something* about IconLayer's texture loading/masking in this
        // environment isn't panning out -- rather than keep guessing at
        // that, use the exact same primitive already confirmed visible for
        // the stop markers (`stopsLayer` below), just larger and with a
        // white outline so it reads as "the vehicle" rather than another stop.
        const driverLayer = new ScatterplotLayer({
            id: 'drivers',
            data: drivers,
            getPosition: toXY,
            radiusUnits: 'pixels',
            getRadius: 12,
            getFillColor: (d) => (d.provenance === 'SIMULATION' ? [255, 112, 67, 255] : [255, 214, 10, 255]),
            getLineColor: [255, 255, 255, 255],
            lineWidthUnits: 'pixels',
            getLineWidth: 2,
            stroked: true,
            pickable: true
        });

        const driverLabels = new TextLayer({
            id: 'driver-labels',
            data: drivers,
            getPosition: toXY,
            getText: (d) => `${d.label || `Route ${d.routeId}`}${d.provenance === 'SIMULATION' ? ' (SIM)' : ''}`,
            getSize: 12,
            getColor: [33, 33, 33, 255],
            background: true,
            getBackgroundColor: (d) => (d.provenance === 'SIMULATION' ? [255, 224, 178, 220] : [255, 255, 255, 200])
        });

        // Solution overlay paths are already built in true [x, y] order by
        // loadSolutionOverlay (its own coordinate-mode fallback), so no swap
        // here regardless of `isEuclidean` -- they use their own resolved
        // solutionPathsEuclidean, which may legitimately differ from the
        // live map's system if the loaded solution is from another instance.
        const solutionLayer =
            showSolution && solutionPaths.length
                ? new PathLayer({
                      id: 'solution-paths',
                      data: solutionPaths,
                      getPath: (d) => d.path,
                      getWidth: 3,
                      getColor: [233, 196, 106, 200],
                      widthUnits: 'pixels',
                      rounded: true,
                      dashJustified: true
                  })
                : null;

        return [baseMap, plannedLayer, observedLayer, stopsLayer, driverLayer, driverLabels, solutionLayer].filter(Boolean);
    }, [drivers, routesData, showSolution, solutionPaths, isEuclidean]);

    return (
        <MainCard title="Live Tracking (Drivers)">
            <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                    Route Execution Simulator
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    <TextField
                        size="small"
                        label="Solution ID"
                        value={simSolutionId}
                        onChange={(e) => setSimSolutionId(e.target.value)}
                        disabled={!!simSession && simStatus !== 'STOPPED'}
                        sx={{ width: 140 }}
                    />
                    {!simSession || simStatus === 'STOPPED' ? (
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<PlayArrowIcon />}
                            onClick={createAndStartSimulation}
                            disabled={simBusy}
                        >
                            Start Simulation
                        </Button>
                    ) : (
                        <ButtonGroup size="small" variant="outlined" disabled={simBusy}>
                            {simStatus === 'RUNNING' && (
                                <Button startIcon={<PauseIcon />} onClick={pauseSimulation}>
                                    Pause
                                </Button>
                            )}
                            {simStatus === 'PAUSED' && (
                                <Button startIcon={<PlayArrowIcon />} onClick={resumeSimulation}>
                                    Resume
                                </Button>
                            )}
                            <Button startIcon={<ReplayIcon />} onClick={resetSimulation}>
                                Reset
                            </Button>
                            <Button startIcon={<StopIcon />} onClick={stopSimulation}>
                                Stop
                            </Button>
                        </ButtonGroup>
                    )}
                    {simSession && (
                        <Select
                            size="small"
                            value={simSession.speedMultiplier || 1}
                            onChange={(e) => changeSimSpeed(Number(e.target.value))}
                            disabled={simBusy || simStatus === 'COMPLETED' || simStatus === 'STOPPED'}
                        >
                            {SPEED_OPTIONS.map((s) => (
                                <MenuItem key={s} value={s}>
                                    {s}×
                                </MenuItem>
                            ))}
                        </Select>
                    )}
                    {simSession && (
                        <Chip
                            size="small"
                            label={simStatus}
                            color={simStatus === 'RUNNING' ? 'success' : simStatus === 'COMPLETED' ? 'info' : 'default'}
                        />
                    )}
                    {simSession && (
                        <Typography variant="body2" color="text.secondary">
                            sim t = {Number(simSession.simTime || 0).toFixed(1)}s
                        </Typography>
                    )}
                    {simError && (
                        <Typography variant="body2" color="error">
                            {simError}
                        </Typography>
                    )}
                </Stack>
                {simSession && (
                    <Box sx={{ mt: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">
                                Visits completed: {simProgress?.completedVisits ?? 0} / {simProgress?.totalVisits ?? 0}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {simProgressPct}%
                            </Typography>
                        </Stack>
                        <LinearProgress variant="determinate" value={simProgressPct} sx={{ height: 6, borderRadius: 3 }} />
                    </Box>
                )}

                {simSession && (
                    <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="subtitle2" gutterBottom>
                            Schedule Event
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                            <Select
                                size="small"
                                value={newEventType}
                                onChange={(e) => setNewEventType(e.target.value)}
                                sx={{ minWidth: 200 }}
                            >
                                {EVENT_TYPE_OPTIONS.map((t) => (
                                    <MenuItem key={t} value={t}>
                                        {t}
                                    </MenuItem>
                                ))}
                            </Select>
                            <TextField
                                size="small"
                                label="Sim time (blank = now)"
                                value={newEventTime}
                                onChange={(e) => setNewEventTime(e.target.value)}
                                sx={{ width: 160 }}
                            />
                            <TextField
                                size="small"
                                label="Entity type"
                                placeholder="vehicle / request"
                                value={newEventEntityType}
                                onChange={(e) => setNewEventEntityType(e.target.value)}
                                sx={{ width: 150 }}
                            />
                            <TextField
                                size="small"
                                label="Entity ID"
                                value={newEventEntityId}
                                onChange={(e) => setNewEventEntityId(e.target.value)}
                                sx={{ width: 110 }}
                            />
                            <TextField
                                size="small"
                                label="Payload (JSON, optional)"
                                value={newEventPayload}
                                onChange={(e) => setNewEventPayload(e.target.value)}
                                sx={{ minWidth: 220 }}
                            />
                            <Button variant="outlined" size="small" onClick={scheduleSimEvent} disabled={simBusy}>
                                Schedule
                            </Button>
                        </Stack>

                        <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                            Event Timeline
                        </Typography>
                        {simEvents.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                No events yet for this session.
                            </Typography>
                        ) : (
                            <Stack spacing={0.5} sx={{ maxHeight: 220, overflowY: 'auto' }}>
                                {[...simEvents].reverse().map((ev) => (
                                    <Stack
                                        key={ev.id}
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
                                    >
                                        <Typography variant="caption" sx={{ width: 70, fontFamily: 'monospace' }}>
                                            t={(ev.occurredSimTime ?? ev.scheduledSimTime).toFixed(1)}
                                        </Typography>
                                        <Chip size="small" label={ev.status} variant="outlined" sx={{ width: 90 }} />
                                        <Typography variant="body2" sx={{ minWidth: 160, fontWeight: 600 }}>
                                            {ev.eventType}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>
                                            {ev.affectedEntityType ? `${ev.affectedEntityType}#${ev.affectedEntityId}` : ''}
                                        </Typography>
                                        <Chip size="small" label={`source: ${ev.source}`} sx={{ height: 20 }} />
                                        {ev.status === 'PROCESSED' && (
                                            <Chip
                                                size="small"
                                                label={ev.requiresReplanning ? 'Replanning required' : 'No replan needed'}
                                                color={ev.requiresReplanning ? 'warning' : 'default'}
                                            />
                                        )}
                                    </Stack>
                                ))}
                            </Stack>
                        )}
                    </Box>
                )}
            </Box>

            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
                <TextField
                    size="small"
                    label="Solution IDs (comma separated)"
                    value={solutionIds}
                    onChange={(e) => setSolutionIds(e.target.value)}
                    sx={{ minWidth: 260 }}
                />
                <Button variant="contained" size="small" onClick={loadSolutionOverlay}>
                    Load Solution Overlay
                </Button>
                <FormControlLabel
                    control={<Switch checked={showSolution} onChange={(e) => setShowSolution(e.target.checked)} />}
                    label="Show solution routes"
                    disabled={!solutionPaths.length}
                />
                {solutionPaths.length > 0 && (
                    <Chip size="small" variant="outlined" label={solutionPathsEuclidean ? 'Overlay: Euclidean' : 'Overlay: geodesic'} />
                )}
                {coordSystem && <Chip size="small" label={isEuclidean ? 'Live map: Euclidean' : 'Live map: geodesic'} />}
                {!loading && !drivers.length && (
                    <Typography variant="body2" color="text.secondary">
                        No live vehicles yet — check server URL and make sure routes have positions.
                    </Typography>
                )}
            </Stack>

            {loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 360 }}>
                    <CircularProgress />
                </Stack>
            ) : (
                <Box sx={{ height: 640, borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
                    <DeckGL
                        style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#111827' }}
                        views={isEuclidean ? new OrthographicView({ id: 'ortho' }) : new MapView({ repeat: true })}
                        controller
                        viewState={viewState}
                        initialViewState={isEuclidean ? defaultEuclideanView : defaultGeoView}
                        layers={layers}
                        getTooltip={({ object }) =>
                            object && object.lat && object.lng
                                ? `${object.label || `Route ${object.routeId}`}${object.recordedAt ? `\nUpdated: ${object.recordedAt}` : ''}`
                                : null
                        }
                        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
                    />
                </Box>
            )}
        </MainCard>
    );
};

export default LiveRoutes;
