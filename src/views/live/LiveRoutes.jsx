import { useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { MapView } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, IconLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { Box, Button, CircularProgress, Stack, Switch, TextField, Typography, FormControlLabel } from '@mui/material';
import io from 'socket.io-client';

import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const defaultView = {
    longitude: -8.6,
    latitude: 40.2,
    zoom: 6,
    pitch: 0,
    bearing: 0
};

const LiveRoutes = () => {
    const [drivers, setDrivers] = useState([]);
    const [routesData, setRoutesData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewState, setViewState] = useState(defaultView);
    const [solutionIds, setSolutionIds] = useState('');
    const [solutionPaths, setSolutionPaths] = useState([]);
    const [showSolution, setShowSolution] = useState(false);
    const socketRef = useRef(null);

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
                    recordedAt: veh?.current?.recordedAt || null
                });
            });
        });
        setDrivers(driverPoints);
        if (driverPoints.length) {
            setViewState((prev) => ({
                ...prev,
                longitude: driverPoints[0].lng,
                latitude: driverPoints[0].lat,
                zoom: 9
            }));
        }
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
            const solutions = payload?.solutions || {};
            const paths = [];
            Object.entries(solutions).forEach(([sid, sol]) => {
                sol.routes.forEach((route, idx) => {
                    const path = route.stops
                        .map((stop) => nodes[stop.node_id])
                        .filter(Boolean)
                        .map((node) => [node.lng ?? node.longitude, node.lat ?? node.latitude])
                        .filter((p) => p[0] !== undefined && p[1] !== undefined);
                    if (path.length > 1) {
                        paths.push({ id: `${sid}-${idx}`, path });
                    }
                });
            });
            setSolutionPaths(paths);
            setShowSolution(true);
        } catch (e) {
            console.error('Failed to load solution overlay', e);
        }
    };

    const layers = useMemo(() => {
        const baseMap = new TileLayer({
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
            getPath: (r) => (r.plannedPath || []).map((p) => [p.lng, p.lat]),
            getWidth: 3,
            widthUnits: 'pixels',
            getColor: (r) => [...colorForRoute(r.id), 160],
            rounded: true,
            visible: true
        });

        const observedLayer = new PathLayer({
            id: 'observed-routes',
            data: routesData.filter((r) => (r.observedPath || []).length > 1),
            getPath: (r) => (r.observedPath || []).map((p) => [p.lng, p.lat]),
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
            getPosition: (d) => [d.coords?.lng, d.coords?.lat],
            getFillColor: [171, 71, 188, 210],
            getRadius: 80,
            visible: true,
            pickable: true,
            stroked: false
        });

        const driverLayer = new IconLayer({
            id: 'drivers',
            data: drivers,
            getPosition: (d) => [d.lng, d.lat],
            getSize: () => 48,
            sizeUnits: 'pixels',
            getColor: [255, 214, 10, 255],
            getIcon: () => 'car',
            iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/icon-atlas.png',
            iconMapping: {
                car: { x: 0, y: 0, width: 128, height: 128, anchorY: 112 }
            },
            pickable: true
        });

        const driverLabels = new TextLayer({
            id: 'driver-labels',
            data: drivers,
            getPosition: (d) => [d.lng, d.lat],
            getText: (d) => d.label || `Route ${d.routeId}`,
            getSize: 12,
            getColor: [33, 33, 33, 255],
            background: true,
            getBackgroundColor: [255, 255, 255, 200]
        });

        const solutionLayer =
            showSolution && solutionPaths.length
                ? new PathLayer({
                      id: 'solution-paths',
                      data: solutionPaths,
                      getPath: (d) => d.path.map((p) => [p[0], p[1]]),
                      getWidth: 3,
                      getColor: [233, 196, 106, 200],
                      widthUnits: 'pixels',
                      rounded: true,
                      dashJustified: true
                  })
                : null;

        return [baseMap, plannedLayer, observedLayer, stopsLayer, driverLayer, driverLabels, solutionLayer].filter(Boolean);
    }, [drivers, routesData, showSolution, solutionPaths]);

    return (
        <MainCard title="Live Tracking (Drivers)">
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
                        views={new MapView({ repeat: true })}
                        controller
                        viewState={viewState}
                        initialViewState={defaultView}
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
