import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import DeckGL from '@deck.gl/react';
import { OrbitView } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import * as d3 from 'd3';
import { Box, Chip, CircularProgress, Skeleton, Stack, Typography } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import GridOnIcon from '@mui/icons-material/GridOn';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';
import 'leaflet/dist/leaflet.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const MAP_HEIGHT = 400;

// ── helpers ──────────────────────────────────────────────────────────────────

function FitBounds({ nodes }) {
    const map = useMap();
    useEffect(() => {
        const pts = nodes.filter((n) => n.lat != null && n.lng != null);
        if (!pts.length) return;
        const lats = pts.map((n) => n.lat);
        const lngs = pts.map((n) => n.lng);
        map.fitBounds(
            [
                [Math.min(...lats), Math.min(...lngs)],
                [Math.max(...lats), Math.max(...lngs)]
            ],
            { padding: [30, 30], maxZoom: 14 }
        );
    }, [map, nodes]);
    return null;
}

// ── Geographical renderer (Leaflet + OSM) ────────────────────────────────────

function GeoNodesMap({ nodes }) {
    return (
        <MapContainer center={[0, 0]} zoom={2} style={{ height: MAP_HEIGHT, width: '100%', borderRadius: 8 }} zoomControl={false}>
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

        const xs = nodes.map((n) => n.x);
        const ys = nodes.map((n) => n.y);
        const xScale = d3
            .scaleLinear()
            .domain([Math.min(...xs), Math.max(...xs)])
            .range([pad, W - pad]);
        const yScale = d3
            .scaleLinear()
            .domain([Math.min(...ys), Math.max(...ys)])
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

    const { data, scale } = useMemo(() => {
        if (!nodes.length) return { data: [], scale: 1 };
        const xs = nodes.map((n) => n.x);
        const ys = nodes.map((n) => n.y);
        const zs = nodes.map((n) => n.z ?? 0);
        const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
        const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
        const cz = (Math.max(...zs) + Math.min(...zs)) / 2;
        const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
        const sc = 200 / spread;
        return {
            data: nodes.map((n) => ({
                position: [(n.x - cx) * sc, (n.y - cy) * sc, ((n.z ?? 0) - cz) * sc],
                color: n.isDepot ? [229, 57, 53, 230] : [25, 118, 210, 180]
            })),
            scale: sc
        };
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

function Legend({ depotCount, customerCount }) {
    return (
        <Stack direction="row" spacing={2} alignItems="center">
            <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e53935' }} />
                <Typography variant="caption">Depots ({depotCount})</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#1976d2' }} />
                <Typography variant="caption">Customers ({customerCount})</Typography>
            </Stack>
        </Stack>
    );
}

// ── Main widget ───────────────────────────────────────────────────────────────

const NodeMapWidget = ({ instance }) => {
    const [nodes, setNodes] = useState([]);
    const [coordMode, setCoordMode] = useState(null);
    const [hasZ, setHasZ] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!instance?.id) return;
        setLoading(true);
        setError(null);
        authAxios
            .get(`${API_BASE}/api/v1/dataset_instances/${instance.id}/nodes`)
            .then((res) => {
                const result = res?.data?.result;
                if (!result) throw new Error('Empty response');
                const nodeList = Object.values(result.nodes || {});
                setNodes(nodeList);
                setCoordMode(result.coordinates);
                setHasZ(result.has_z);
            })
            .catch((e) => setError(e?.message || 'Failed to load nodes'))
            .finally(() => setLoading(false));
    }, [instance?.id]);

    const depots = nodes.filter((n) => n.isDepot);
    const customers = nodes.filter((n) => !n.isDepot);

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
        if (!nodes.length) {
            return (
                <Box sx={{ height: MAP_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.secondary" variant="body2">
                        No nodes found for this instance.
                    </Typography>
                </Box>
            );
        }
        if (coordMode === 'lat_lng') return <GeoNodesMap nodes={nodes} />;
        if (hasZ) return <Euclidean3DMap nodes={nodes} />;
        return <Euclidean2DMap nodes={nodes} />;
    };

    return (
        <MainCard title={cardTitle} content={false} sx={{ overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.5 }}>
                {nodes.length > 0 && !loading && <Legend depotCount={depots.length} customerCount={customers.length} />}
            </Box>
            <Box sx={{ px: 2, pb: 2 }}>{renderMap()}</Box>
        </MainCard>
    );
};

export default NodeMapWidget;
