import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import DeckGL from '@deck.gl/react';
import { OrbitView } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import * as d3 from 'd3';
import { Box, Chip, MenuItem, Select, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import GridOnIcon from '@mui/icons-material/GridOn';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import MainCard from 'ui-component/cards/MainCard';
import { capNodes, extent, padDomain } from 'ui-component/viae-map/scale/budget';
import authAxios from 'utils/axios';
import 'leaflet/dist/leaflet.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const MAP_HEIGHT = 400;

// Render budget. One marker per node means a 50k-node instance can freeze or
// kill the browser tab, so both ends of the wire cap the count: the API caps
// what it sends (?limit=), and the renderers cap what they draw. The options
// below are what the user can pick from; the API clamps anything larger.
const NODE_LIMIT_OPTIONS = [500, 2000, 5000, 10000];
const DEFAULT_NODE_LIMIT = 2000;

// ── helpers ──────────────────────────────────────────────────────────────────

const hasGeoCoords = (n) => Number.isFinite(n?.lat) && Number.isFinite(n?.lng);
const hasPlanarCoords = (n) => Number.isFinite(n?.x) && Number.isFinite(n?.y);

// extent / padDomain / capNodes moved verbatim to the shared visualization
// module so every visualizer gets the same render-budget behaviour -- they
// were the only scale-aware code in the frontend and were private to this
// widget. See src/ui-component/viae-map/scale/budget.js.

function FitBounds({ nodes }) {
    const map = useMap();
    useEffect(() => {
        if (!nodes.length) return;
        const [minLat, maxLat] = extent(nodes.map((n) => n.lat));
        const [minLng, maxLng] = extent(nodes.map((n) => n.lng));
        if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return;
        map.fitBounds(
            [
                [minLat, minLng],
                [maxLat, maxLng]
            ],
            { padding: [30, 30], maxZoom: 14 }
        );
    }, [map, nodes]);
    return null;
}

// ── Geographical renderer (Leaflet + OSM) ────────────────────────────────────

function GeoNodesMap({ nodes }) {
    return (
        // preferCanvas: one <canvas> instead of one SVG <path> per node -- the
        // difference between "sluggish" and "tab dies" at a few thousand nodes.
        <MapContainer
            preferCanvas
            center={[0, 0]}
            zoom={2}
            style={{ height: MAP_HEIGHT, width: '100%', borderRadius: 8 }}
            zoomControl={false}
        >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            <ZoomControl position="bottomright" />
            <FitBounds nodes={nodes} />
            {nodes.map((node) => (
                <CircleMarker
                    key={node.id}
                    center={[node.lat, node.lng]}
                    radius={node.isDepot ? 9 : 5}
                    pathOptions={{
                        fillColor: node.isDepot ? '#e53935' : '#1976d2',
                        color: node.isDepot ? '#b71c1c' : '#0d47a1',
                        fillOpacity: 0.88,
                        weight: 1.5
                    }}
                >
                    <Popup>
                        {node.isDepot ? 'Depot' : 'Customer'} #{node.id}
                    </Popup>
                </CircleMarker>
            ))}
        </MapContainer>
    );
}

// ── Euclidean 2-D renderer (D3 SVG with pan/zoom) ────────────────────────────

function Euclidean2DMap({ nodes }) {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const zoomRef = useRef(null);

    useEffect(() => {
        if (!svgRef.current || !containerRef.current || !nodes.length) return;
        const W = containerRef.current.clientWidth || 640;
        const H = MAP_HEIGHT;
        const pad = 40;

        const xScale = d3
            .scaleLinear()
            .domain(padDomain(extent(nodes.map((n) => n.x))))
            .range([pad, W - pad]);
        const yScale = d3
            .scaleLinear()
            .domain(padDomain(extent(nodes.map((n) => n.y))))
            .range([H - pad, pad]);

        const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);
        svg.selectAll('*').remove();

        // subtle grid
        const grid = svg.append('g').attr('class', 'grid').attr('stroke', '#ddd').attr('stroke-opacity', 0.7);
        xScale.ticks(10).forEach((x) =>
            grid
                .append('line')
                .attr('x1', xScale(x))
                .attr('x2', xScale(x))
                .attr('y1', pad)
                .attr('y2', H - pad)
        );
        yScale.ticks(10).forEach((y) =>
            grid
                .append('line')
                .attr('x1', pad)
                .attr('x2', W - pad)
                .attr('y1', yScale(y))
                .attr('y2', yScale(y))
        );

        // zoomable group
        const g = svg.append('g');

        const depots = nodes.filter((n) => n.isDepot);
        const customers = nodes.filter((n) => !n.isDepot);

        // edges at lowest z so they appear under nodes (empty for nodes-only view)
        // customers
        g.selectAll('circle.customer')
            .data(customers)
            .enter()
            .append('circle')
            .attr('cx', (d) => xScale(d.x))
            .attr('cy', (d) => yScale(d.y))
            .attr('r', 4.5)
            .attr('fill', '#1976d2')
            .attr('fill-opacity', 0.8)
            .attr('stroke', '#0d47a1')
            .attr('stroke-width', 1);

        // depots on top
        g.selectAll('circle.depot')
            .data(depots)
            .enter()
            .append('circle')
            .attr('cx', (d) => xScale(d.x))
            .attr('cy', (d) => yScale(d.y))
            .attr('r', 8)
            .attr('fill', '#e53935')
            .attr('fill-opacity', 0.9)
            .attr('stroke', '#b71c1c')
            .attr('stroke-width', 1.5);

        // pan / zoom
        const zoom = d3
            .zoom()
            .scaleExtent([0.5, 20])
            .on('zoom', (event) => g.attr('transform', event.transform));
        svg.call(zoom);
        zoomRef.current = zoom;

        // reset on double-click
        svg.on('dblclick.zoom', () => svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity));
    }, [nodes]);

    return (
        <Box ref={containerRef} sx={{ width: '100%', borderRadius: 2, overflow: 'hidden', cursor: 'grab' }}>
            <svg ref={svgRef} style={{ display: 'block', background: '#fafafa' }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', mt: 0.5, pr: 1 }}>
                Scroll to zoom · Drag to pan · Double-click to reset
            </Typography>
        </Box>
    );
}

// ── Euclidean 3-D renderer (deck.gl OrbitView) ───────────────────────────────

function Euclidean3DMap({ nodes }) {
    const [viewState, setViewState] = useState({
        target: [0, 0, 0],
        rotationX: 25,
        rotationOrbit: -20,
        zoom: 0,
        minZoom: -5,
        maxZoom: 10
    });

    const data = useMemo(() => {
        if (!nodes.length) return [];
        const [minX, maxX] = extent(nodes.map((n) => n.x));
        const [minY, maxY] = extent(nodes.map((n) => n.y));
        const [minZ, maxZ] = extent(nodes.map((n) => (Number.isFinite(n.z) ? n.z : 0)));
        const cx = (maxX + minX) / 2;
        const cy = (maxY + minY) / 2;
        const cz = (maxZ + minZ) / 2;
        const spread = Math.max(maxX - minX, maxY - minY, 1);
        const sc = 200 / spread;
        return nodes.map((n) => ({
            position: [(n.x - cx) * sc, (n.y - cy) * sc, ((Number.isFinite(n.z) ? n.z : 0) - cz) * sc],
            color: n.isDepot ? [229, 57, 53, 230] : [25, 118, 210, 180]
        }));
    }, [nodes]);

    const layers = [
        new ScatterplotLayer({
            id: 'nodes-3d',
            data,
            getPosition: (d) => d.position,
            getColor: (d) => d.color,
            getRadius: (d) => (d.color[0] === 229 ? 8 : 4),
            radiusMinPixels: 3,
            pickable: false
        })
    ];

    return (
        <Box sx={{ height: MAP_HEIGHT, position: 'relative', borderRadius: 2, overflow: 'hidden', background: '#f0f4f8' }}>
            <DeckGL
                views={new OrbitView({ id: 'orbit' })}
                viewState={viewState}
                onViewStateChange={({ viewState: vs }) => setViewState(vs)}
                controller={true}
                layers={layers}
                style={{ width: '100%', height: '100%' }}
            />
            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ position: 'absolute', bottom: 8, right: 12, background: 'rgba(255,255,255,0.7)', px: 1, borderRadius: 1 }}
            >
                Drag to rotate · Scroll to zoom
            </Typography>
        </Box>
    );
}

// ── Legend ───────────────────────────────────────────────────────────────────

function Legend({ depotCount, customerCount, shownCount, totalCount, skippedNoCoords }) {
    const isSample = totalCount > shownCount;
    return (
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e53935' }} />
                <Typography variant="caption">Depots ({depotCount})</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#1976d2' }} />
                <Typography variant="caption">Customers ({customerCount})</Typography>
            </Stack>
            {isSample && (
                <Tooltip title="Only a sample is drawn so the map stays responsive. Every depot is kept; customers are evenly sampled. Raise the limit above if you need more.">
                    <Chip
                        size="small"
                        variant="outlined"
                        color="warning"
                        label={`Showing ${shownCount.toLocaleString()} of ${totalCount.toLocaleString()} nodes`}
                        sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                </Tooltip>
            )}
            {skippedNoCoords > 0 && (
                <Tooltip title="These nodes carry no coordinates in the coordinate system this instance uses, so they cannot be placed on the map.">
                    <Chip
                        size="small"
                        variant="outlined"
                        label={`${skippedNoCoords.toLocaleString()} without coordinates`}
                        sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                </Tooltip>
            )}
        </Stack>
    );
}

// ── Main widget ───────────────────────────────────────────────────────────────

const NodeMapWidget = ({ instance }) => {
    const [nodes, setNodes] = useState([]);
    const [coordMode, setCoordMode] = useState(null);
    const [hasZ, setHasZ] = useState(false);
    const [totalNodes, setTotalNodes] = useState(0);
    const [nodeLimit, setNodeLimit] = useState(DEFAULT_NODE_LIMIT);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!instance?.id) return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);
        authAxios
            .get(`${API_BASE}/api/v1/dataset_instances/${instance.id}/nodes`, { params: { limit: nodeLimit } })
            .then((res) => {
                if (cancelled) return;
                const result = res?.data?.result;
                if (!result) throw new Error('Empty response');
                const nodeList = Object.values(result.nodes || {});
                setNodes(nodeList);
                setCoordMode(result.coordinates);
                setHasZ(result.has_z);
                // Older API builds don't send `total`; fall back to what arrived.
                setTotalNodes(Number.isFinite(result.total) ? result.total : nodeList.length);
            })
            .catch((e) => {
                if (!cancelled) setError(e?.message || 'Failed to load nodes');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [instance?.id, nodeLimit]);

    // Drop anything the active renderer cannot place, then cap what's left.
    // Without the first step a node missing coordinates reaches Leaflet as
    // (undefined, undefined) and throws "Invalid LatLng object".
    const { renderable, skippedNoCoords } = useMemo(() => {
        const usable = coordMode === 'lat_lng' ? nodes.filter(hasGeoCoords) : nodes.filter(hasPlanarCoords);
        return { renderable: capNodes(usable, nodeLimit), skippedNoCoords: nodes.length - usable.length };
    }, [nodes, coordMode, nodeLimit]);

    const depots = renderable.filter((n) => n.isDepot);
    const customers = renderable.filter((n) => !n.isDepot);

    const modeLabel = coordMode === 'lat_lng' ? 'Geographical' : hasZ ? '3D Euclidean' : '2D Euclidean';
    const modeIcon =
        coordMode === 'lat_lng' ? (
            <PublicIcon sx={{ fontSize: 14 }} />
        ) : hasZ ? (
            <ViewInArIcon sx={{ fontSize: 14 }} />
        ) : (
            <GridOnIcon sx={{ fontSize: 14 }} />
        );

    const cardTitle = (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="h4">Node Map</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                    Max nodes
                </Typography>
                <Select
                    value={nodeLimit}
                    onChange={(e) => setNodeLimit(Number(e.target.value))}
                    size="small"
                    variant="outlined"
                    sx={{ height: 26, fontSize: '0.72rem', '& .MuiSelect-select': { py: 0.25 } }}
                >
                    {NODE_LIMIT_OPTIONS.map((opt) => (
                        <MenuItem key={opt} value={opt} sx={{ fontSize: '0.78rem' }}>
                            {opt.toLocaleString()}
                        </MenuItem>
                    ))}
                </Select>
                {coordMode && (
                    <Chip
                        icon={modeIcon}
                        label={modeLabel}
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{ height: 24, fontSize: '0.72rem' }}
                    />
                )}
            </Stack>
        </Stack>
    );

    const renderMap = () => {
        if (loading) {
            return <Skeleton variant="rectangular" height={MAP_HEIGHT} sx={{ borderRadius: 2 }} />;
        }
        if (error) {
            return (
                <Box sx={{ height: MAP_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="error" variant="body2">
                        {error}
                    </Typography>
                </Box>
            );
        }
        if (!renderable.length) {
            return (
                <Box sx={{ height: MAP_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.secondary" variant="body2">
                        {nodes.length ? 'No node in this instance has usable coordinates.' : 'No nodes found for this instance.'}
                    </Typography>
                </Box>
            );
        }
        if (coordMode === 'lat_lng') return <GeoNodesMap nodes={renderable} />;
        if (hasZ) return <Euclidean3DMap nodes={renderable} />;
        return <Euclidean2DMap nodes={renderable} />;
    };

    return (
        <MainCard title={cardTitle} content={false} sx={{ overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.5 }}>
                {renderable.length > 0 && !loading && (
                    <Legend
                        depotCount={depots.length}
                        customerCount={customers.length}
                        shownCount={renderable.length}
                        totalCount={Math.max(totalNodes, renderable.length)}
                        skippedNoCoords={skippedNoCoords}
                    />
                )}
            </Box>
            <Box sx={{ px: 2, pb: 2 }}>{renderMap()}</Box>
        </MainCard>
    );
};

export default NodeMapWidget;
