import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as d3 from 'd3';
import {
    Box,
    Checkbox,
    Collapse,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    OutlinedInput,
    Select,
    Stack,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    Grid,
    Tooltip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// D3-based, canvas renderer for large instances and multiple solutions
// Supports two coordinate modes: 'euclidean' (x,y) and 'geo' (lat,lng via Mercator projection)

const ITEM_HEIGHT = 42;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
    PaperProps: {
        style: {
            maxHeight: ITEM_HEIGHT * 6 + ITEM_PADDING_TOP,
            width: 280
        }
    }
};

const defaultColors = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999', '#66c2a5', '#1b9e77'];

function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

function boundBox(points) {
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
    for (const [x, y] of points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function haversine(p1, p2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lng - p1.lng);
    const lat1 = toRad(p1.lat);
    const lat2 = toRad(p2.lat);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // meters
}

function computeEuclidean(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy);
}

function normalizeNodes(nodes) {
    // Accepts array or object keyed by id; returns a Map(id -> node)
    if (!nodes) return new Map();
    if (Array.isArray(nodes)) {
        return new Map(nodes.map((n) => [n.id ?? n.node_id ?? n.key, n]));
    }
    return new Map(Object.entries(nodes).map(([k, v]) => [isNaN(+k) ? k : +k, v]));
}

function getNodeCoords(node, mode) {
    return mode === 'geo' ? [node.lng, node.lat] : [node.x, node.y];
}

function D3SolutionVisualizer({
    instance,
    solutions: solutionsProp,
    defaultSelected,
    mode: modeProp, // 'euclidean' | 'geo'
    height = 520
}) {
    // Query param support: ?solutions=1,2&mode=geo&links=1
    const query = useQuery();
    const querySolutionIds = useMemo(() => {
        const s = query.get('solutions');
        if (!s) return [];
        return s
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => (isNaN(+x) ? x : +x));
    }, [query]);
    const queryMode = query.get('mode');

    const canvasRef = useRef(null);
    const overlayRef = useRef(null); // for hit regions later if needed
    const zoomRef = useRef();
    const [transform, setTransform] = useState(d3.zoomIdentity);

    const nodesById = useMemo(() => normalizeNodes(instance?.nodes), [instance]);
    const links = instance?.links || [];
    const [showNodes, setShowNodes] = useState(true);
    const [showLinks, setShowLinks] = useState(true);
    const [showRoutes, setShowRoutes] = useState(true);
    const [perRouteColors, setPerRouteColors] = useState(false);
    // Per-solution routes dropdown open/closed
    const [routesPanelOpenMap, setRoutesPanelOpenMap] = useState({});
    // Hovered route for highlight { sid, key } | null
    const [hoveredRoute, setHoveredRoute] = useState(null);
    const [splitMode, setSplitMode] = useState(false);
    // Visibility map: { [solutionId: string]: string[] /*route keys visible*/ }
    const [visibleRoutes, setVisibleRoutes] = useState({});
    // Expanded routes map (to show stops): { [solutionId: string]: string[] /*route keys expanded*/ }
    const [expandedRoutes, setExpandedRoutes] = useState({});
    const [mode, setMode] = useState(() =>
        modeProp
            ? modeProp === 'geo'
                ? 'geo'
                : 'euclidean'
            : queryMode === 'geo'
              ? 'geo'
              : (instance?.coordinates || '').toLowerCase().includes('lat')
                ? 'geo'
                : 'euclidean'
    );

    // Solutions input normalization: accepts object by id or array
    const allSolutions = useMemo(() => {
        if (!solutionsProp) return {};
        if (Array.isArray(solutionsProp)) {
            const obj = {};
            solutionsProp.forEach((s) => (obj[s.id] = s));
            return obj;
        }
        return solutionsProp;
    }, [solutionsProp]);

    // Work with string ids internally to avoid number/string duplication
    const allSolutionIds = useMemo(() => Object.keys(allSolutions), [allSolutions]);
    const [selectedSolutions, setSelectedSolutions] = useState(() => {
        if (defaultSelected && defaultSelected.length) return defaultSelected.map((x) => String(x));
        if (querySolutionIds.length) return querySolutionIds.map((x) => String(x));
        return allSolutionIds.slice(0, 2);
    });

    // Sync selection when props or loaded solutions change
    useEffect(() => {
        if (defaultSelected && defaultSelected.length) {
            setSelectedSolutions(defaultSelected.map((x) => String(x)));
            return;
        }
        if ((!selectedSolutions || selectedSolutions.length === 0) && allSolutionIds.length) {
            setSelectedSolutions(allSolutionIds.slice(0, Math.min(2, allSolutionIds.length)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultSelected, allSolutionIds.join('|')]);

    // Build projection/scales based on mode and nodes
    const projection = useMemo(() => {
        if (mode !== 'geo') return null;
        const pts = Array.from(nodesById.values())
            .filter((n) => n.lat != null && n.lng != null)
            .map((n) => [n.lng, n.lat]);
        const { width } = getCanvasSize();
        const h = height;
        const proj = d3.geoMercator();
        if (pts.length) {
            const [[minLng, minLat], [maxLng, maxLat]] = d3.geoBounds({ type: 'MultiPoint', coordinates: pts });
            const feature = {
                type: 'Polygon',
                coordinates: [
                    [
                        [minLng, minLat],
                        [minLng, maxLat],
                        [maxLng, maxLat],
                        [maxLng, minLat],
                        [minLng, minLat]
                    ]
                ]
            };
            const path = d3.geoPath(proj);
            // Fit extent with nice padding
            proj.fitExtent(
                [
                    [20, 20],
                    [width - 20, h - 20]
                ],
                feature
            );
        } else {
            proj.scale((width / (2 * Math.PI)) * 150).translate([width / 2, h / 2]);
        }
        return proj;
    }, [mode, nodesById, height]);

    const xyScales = useMemo(() => {
        if (mode === 'geo') return null;
        const pts = Array.from(nodesById.values())
            .filter((n) => n.x != null && n.y != null)
            .map((n) => [n.x, n.y]);
        const { minX, minY, maxX, maxY } = boundBox(pts);
        const { width } = getCanvasSize();
        const h = height;
        const padding = 20;
        const x = d3
            .scaleLinear()
            .domain([minX, maxX])
            .range([padding, width - padding]);
        const y = d3
            .scaleLinear()
            .domain([minY, maxY])
            .range([h - padding, padding]);
        return { x, y };
    }, [mode, nodesById, height]);

    function getCanvasSize() {
        // Canvas width follows container; fallback to 100% of parent
        const parent = canvasRef.current?.parentElement;
        const width = parent ? parent.clientWidth : 960;
        return { width, height };
    }

    function projectPoint(node) {
        if (mode === 'geo') {
            const p = projection([node.lng, node.lat]);
            return p ? { x: p[0], y: p[1] } : { x: 0, y: 0 };
        }
        return { x: xyScales.x(node.x), y: xyScales.y(node.y) };
    }

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { width, height: h } = getCanvasSize();
        canvas.width = width;
        canvas.height = h;

        ctx.save();
        ctx.clearRect(0, 0, width, h);
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);

        // Links (instance graph)
        if (showLinks && links?.length) {
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#9e9e9e';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (const e of links) {
                const s = nodesById.get(e.source);
                const t = nodesById.get(e.target);
                if (!s || !t) continue;
                const ps = projectPoint(s);
                const pt = projectPoint(t);
                ctx.moveTo(ps.x, ps.y);
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
            ctx.closePath();
            ctx.globalAlpha = 1;
        }

        // Routes for selected solutions
        if (showRoutes && selectedSolutions?.length) {
            selectedSolutions.forEach((sid, idx) => {
                const sol = allSolutions[sid];
                if (!sol) return;
                const solColor = defaultColors[idx % defaultColors.length];
                ctx.globalAlpha = 0.9;
                ctx.lineWidth = 1.5;
                const routeColor = routeColorBySolution[sid] || d3.scaleOrdinal(d3.schemeTableau10);
                const visSet = new Set(visibleRoutes[sid] || []);
                const hasHover = !!(hoveredRoute && hoveredRoute.sid === sid);
                (sol.routes || []).forEach((route, rIndex) => {
                    const rKey = String(route.id ?? `${sid}-${rIndex}`);
                    if (visSet && !visSet.has(rKey)) return; // hidden
                    const isHovered = hasHover && hoveredRoute.key === rKey;
                    ctx.strokeStyle = perRouteColors ? routeColor(rKey) : solColor;
                    ctx.globalAlpha = hasHover ? (isHovered ? 1.0 : 0.2) : 0.9;
                    ctx.lineWidth = isHovered ? 2.5 : 1.5;
                    // Sort by sequence and draw contiguous straight lines
                    const stops = [...(route.stops || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
                    if (stops.length < 2) {
                        return;
                    }
                    ctx.beginPath();
                    for (let i = 0; i < stops.length - 1; i++) {
                        const s = nodesById.get(stops[i].node_id);
                        const t = nodesById.get(stops[i + 1].node_id);
                        if (!s || !t) continue;
                        const ps = projectPoint(s);
                        const pt = projectPoint(t);
                        ctx.moveTo(ps.x, ps.y);
                        ctx.lineTo(pt.x, pt.y);
                    }
                    ctx.stroke();
                    ctx.closePath();
                });
                ctx.globalAlpha = 1;
            });
        }

        // Nodes
        if (showNodes && nodesById.size) {
            ctx.globalAlpha = 0.95;
            for (const n of nodesById.values()) {
                const { x, y } = projectPoint(n);
                const isDepot = n.isDepot || n.type === 'depot' || n.category === 'depot';
                ctx.fillStyle = isDepot ? '#d32f2f' : '#1976d2';
                ctx.beginPath();
                ctx.arc(x, y, isDepot ? 3.5 : 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.closePath();
            }
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    };

    useEffect(() => {
        // Set up d3-zoom on overlay div (for crisp canvas).
        // Re-bind when splitMode changes because DOM nodes change.
        const overlay = overlayRef.current;
        if (!overlay || splitMode) return;
        const zoom = d3
            .zoom()
            .scaleExtent([0.2, 40])
            .on('zoom', (event) => {
                setTransform(event.transform);
            });
        zoomRef.current = zoom;
        const sel = d3.select(overlay);
        sel.call(zoom);
        return () => {
            sel.on('.zoom', null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [splitMode]);

    useEffect(() => {
        if (splitMode) return; // don't draw in single-canvas when split mode is active
        draw();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        transform,
        showNodes,
        showLinks,
        showRoutes,
        nodesById,
        links,
        allSolutions,
        selectedSolutions,
        projection,
        xyScales,
        mode,
        perRouteColors,
        JSON.stringify(visibleRoutes),
        JSON.stringify(hoveredRoute),
        splitMode
    ]);

    // Stats calculation for selected solutions
    const { solutionStats, routeStatsBySolution } = useMemo(() => {
        const solutionStats = [];
        const routeStatsBySolution = {}; // sid -> [{ key, id, index, nStops, length }]
        for (const sid of selectedSolutions) {
            const sol = allSolutions[sid];
            if (!sol) continue;
            let totalLen = 0;
            const list = [];
            (sol.routes || []).forEach((route, rIndex) => {
                const rKey = String(route.id ?? `${sid}-${rIndex}`);
                const stops = [...(route.stops || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
                let len = 0;
                for (let i = 0; i < stops.length - 1; i++) {
                    const s = nodesById.get(stops[i].node_id);
                    const t = nodesById.get(stops[i + 1].node_id);
                    if (!s || !t) continue;
                    len +=
                        mode === 'geo'
                            ? haversine({ lat: s.lat, lng: s.lng }, { lat: t.lat, lng: t.lng })
                            : computeEuclidean({ x: s.x, y: s.y }, { x: t.x, y: t.y });
                }
                totalLen += len;
                list.push({ key: rKey, id: route.id, index: rIndex, nStops: stops.length, length: len });
            });
            routeStatsBySolution[sid] = list;
            solutionStats.push({ id: sid, nRoutes: (sol.routes || []).length, totalLen });
        }
        return { solutionStats, routeStatsBySolution };
    }, [selectedSolutions, allSolutions, nodesById, mode]);

    // Stable per-solution route color scales (consistent mapping)
    const routeColorBySolution = useMemo(() => {
        const out = {};
        for (const sid of selectedSolutions) {
            const keys = (routeStatsBySolution[sid] || []).map((r) => r.key);
            out[sid] = d3.scaleOrdinal(d3.schemeTableau10).domain(keys);
        }
        return out;
    }, [selectedSolutions.join('|'), JSON.stringify(routeStatsBySolution)]);

    // Initialize default route visibility to all routes visible for selected solutions
    useEffect(() => {
        const next = { ...visibleRoutes };
        let changed = false;
        for (const sid of selectedSolutions) {
            const list = routeStatsBySolution[sid] || [];
            const current = new Set(next[sid] || []);
            if (current.size === 0 && list.length > 0) changed = true;
            list.forEach((r) => current.add(r.key));
            next[sid] = Array.from(current);
        }
        // Remove state for solutions no longer selected
        Object.keys(next).forEach((sid) => {
            if (!selectedSolutions.includes(sid)) {
                delete next[sid];
                changed = true;
            }
        });
        if (changed) setVisibleRoutes(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSolutions.join('|'), JSON.stringify(routeStatsBySolution)]);

    const { width } = getCanvasSize();

    return (
        <Box sx={{ width: '100%' }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <FormControl size="small" sx={{ minWidth: 240 }}>
                    <InputLabel id="sv-solutions">Solutions</InputLabel>
                    <Select
                        labelId="sv-solutions"
                        multiple
                        value={selectedSolutions}
                        onChange={(e) => {
                            const v = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                            const vs = v.map((x) => String(x));
                            // ensure unique
                            const uniq = Array.from(new Set(vs));
                            setSelectedSolutions(uniq);
                        }}
                        input={<OutlinedInput label="Solutions" />}
                        renderValue={(sel) => sel.join(', ')}
                        MenuProps={MenuProps}
                    >
                        {allSolutionIds.map((id) => (
                            <MenuItem key={id} value={id}>
                                <Checkbox checked={selectedSolutions.indexOf(id) > -1} />
                                <ListItemText primary={`#${id}`} />
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControlLabel
                    control={<Checkbox checked={showRoutes} onChange={(e) => setShowRoutes(e.target.checked)} />}
                    label="Routes"
                />
                <FormControlLabel
                    control={<Checkbox checked={showNodes} onChange={(e) => setShowNodes(e.target.checked)} />}
                    label="Nodes"
                />
                <FormControlLabel
                    control={<Checkbox checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} />}
                    label="Links"
                />
                <ToggleButtonGroup size="small" color="primary" exclusive value={mode} onChange={(e, v) => v && setMode(v)}>
                    <ToggleButton value="euclidean">Euclidean</ToggleButton>
                    <ToggleButton value="geo">Lat/Lng</ToggleButton>
                </ToggleButtonGroup>
                <FormControlLabel
                    control={<Switch checked={splitMode} onChange={(e) => setSplitMode(e.target.checked)} />}
                    label="Split canvases per solution"
                />
            </Stack>
            <Stack direction="row" spacing={2} alignItems="flex-start">
                {/* Left details panel */}
                <Box sx={{ width: 360, maxHeight: height, overflow: 'auto', borderRight: '1px solid #eee', pr: 1 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Details
                    </Typography>
                    <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ mb: 1 }}>
                        {solutionStats.map((s, idx) => (
                            <Box key={s.id} sx={{ minWidth: 160 }}>
                                <Stack spacing={0.5}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                width: 10,
                                                height: 10,
                                                background: defaultColors[idx % defaultColors.length]
                                            }}
                                        />
                                        <Typography variant="subtitle2">Solution #{s.id}</Typography>
                                    </Stack>
                                    <Typography variant="body2">Routes: {s.nRoutes}</Typography>
                                    <Typography variant="body2">
                                        Length: {mode === 'geo' ? `${(s.totalLen / 1000).toFixed(2)} km` : s.totalLen.toFixed(2)}
                                    </Typography>
                                </Stack>
                            </Box>
                        ))}
                    </Stack>
                    {selectedSolutions.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                <Typography variant="subtitle1">Routes</Typography>
                                <FormControlLabel
                                    sx={{ ml: 2 }}
                                    control={<Checkbox checked={perRouteColors} onChange={(e) => setPerRouteColors(e.target.checked)} />}
                                    label="Distinct route colors"
                                />
                            </Stack>
                            <Stack direction="column" spacing={1}>
                                {selectedSolutions.map((sid, sIndex) => {
                                    const list = routeStatsBySolution[sid] || [];
                                    const routeColor = routeColorBySolution[sid] || d3.scaleOrdinal(d3.schemeTableau10);
                                    const solColor = defaultColors[sIndex % defaultColors.length];
                                    const visArr = visibleRoutes[sid] || [];
                                    const vis = new Set(visArr);
                                    const allChecked = list.length > 0 && list.every((r) => vis.has(r.key));
                                    const toggleAll = (checked) => {
                                        const next = { ...visibleRoutes };
                                        next[sid] = checked ? list.map((r) => r.key) : [];
                                        setVisibleRoutes(next);
                                    };
                                    const expandedArr = expandedRoutes[sid] || [];
                                    const toggleExpanded = (rKey) => {
                                        const next = { ...expandedRoutes };
                                        const arr = Array.from(new Set(expandedArr));
                                        const idx = arr.indexOf(rKey);
                                        if (idx >= 0) arr.splice(idx, 1);
                                        else arr.push(rKey);
                                        next[sid] = arr;
                                        setExpandedRoutes(next);
                                    };
                                    const sol = allSolutions[sid];
                                    return (
                                        <Box key={sid} sx={{ border: '1px solid #eee', borderRadius: 1, p: 1 }}>
                                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                                <span style={{ width: 10, height: 10, background: solColor }} />
                                                <Typography variant="subtitle2">Solution #{sid}</Typography>
                                            </Stack>
                                            {sol && (
                                                <Grid container spacing={1} sx={{ mb: 1 }}>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption">
                                                            Distance: {Number(sol.distance ?? 0).toFixed(2)}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption">
                                                            Travel Time: {Number(sol.travel_time ?? 0).toFixed(2)}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption">Cost: {Number(sol.cost ?? 0).toFixed(2)}</Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption">Vehicles: {sol.n_vehicles ?? '—'}</Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption">Customers: {sol.n_customers ?? '—'}</Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption">
                                                            Feasible: {sol.feasibility ? 'Yes' : 'No'}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            )}
                                            {/* Per-solution Routes dropdown header */}
                                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setRoutesPanelOpenMap((m) => ({ ...m, [sid]: !(m[sid] ?? false) }))}
                                                >
                                                    <ExpandMoreIcon
                                                        style={{
                                                            transform: routesPanelOpenMap[sid] ?? false ? 'rotate(180deg)' : 'rotate(0deg)',
                                                            transition: '200ms'
                                                        }}
                                                    />
                                                </IconButton>
                                                <Typography variant="subtitle1">Routes</Typography>
                                            </Stack>
                                            <Collapse in={routesPanelOpenMap[sid] ?? false} timeout="auto" unmountOnExit>
                                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                size="small"
                                                                checked={allChecked}
                                                                onChange={(e) => toggleAll(e.target.checked)}
                                                            />
                                                        }
                                                        label={<Typography variant="caption">All</Typography>}
                                                    />
                                                    <FormControlLabel
                                                        sx={{ ml: 'auto' }}
                                                        control={
                                                            <Checkbox
                                                                size="small"
                                                                checked={perRouteColors}
                                                                onChange={(e) => setPerRouteColors(e.target.checked)}
                                                            />
                                                        }
                                                        label={<Typography variant="caption">Distinct colors</Typography>}
                                                    />
                                                </Stack>
                                                <Stack direction="column" spacing={0.5}>
                                                    {list.map((r) => {
                                                        const checked = vis.has(r.key);
                                                        const col = perRouteColors ? routeColor(r.key) : solColor;
                                                        const isOpen = expandedArr.includes(r.key);
                                                        const route = (sol?.routes || []).find(
                                                            (rr, idx) => String(rr.id ?? `${sid}-${idx}`) === r.key
                                                        );
                                                        const stops = route?.stops || [];
                                                        return (
                                                            <Box
                                                                key={r.key}
                                                                sx={{ border: '1px dashed #ddd', borderRadius: 1, p: 0.5 }}
                                                                onMouseEnter={() => setHoveredRoute({ sid, key: r.key })}
                                                                onMouseLeave={() => setHoveredRoute(null)}
                                                            >
                                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                                    <FormControlLabel
                                                                        control={
                                                                            <Checkbox
                                                                                size="small"
                                                                                checked={checked}
                                                                                onChange={(e) => {
                                                                                    const next = { ...visibleRoutes };
                                                                                    const arr = Array.from(new Set(visArr));
                                                                                    if (e.target.checked) {
                                                                                        if (!arr.includes(r.key)) arr.push(r.key);
                                                                                    } else {
                                                                                        const idx2 = arr.indexOf(r.key);
                                                                                        if (idx2 >= 0) arr.splice(idx2, 1);
                                                                                    }
                                                                                    next[sid] = arr;
                                                                                    setVisibleRoutes(next);
                                                                                }}
                                                                            />
                                                                        }
                                                                        label={
                                                                            <Typography variant="caption">
                                                                                <span
                                                                                    style={{
                                                                                        display: 'inline-block',
                                                                                        width: 8,
                                                                                        height: 8,
                                                                                        background: col,
                                                                                        marginRight: 6
                                                                                    }}
                                                                                />
                                                                                R{(r.index ?? 0) + 1} • Dist{' '}
                                                                                {Number(route?.distance ?? r.length).toFixed(2)} • Time{' '}
                                                                                {Number(route?.travel_time ?? 0).toFixed(2)} • Cost{' '}
                                                                                {Number(route?.cost ?? 0).toFixed(2)} • Stops {r.nStops}
                                                                            </Typography>
                                                                        }
                                                                    />
                                                                    <IconButton size="small" onClick={() => toggleExpanded(r.key)}>
                                                                        <ExpandMoreIcon
                                                                            style={{
                                                                                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                                transition: '200ms'
                                                                            }}
                                                                        />
                                                                    </IconButton>
                                                                </Stack>
                                                                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                                                    <List dense sx={{ pl: 1 }}>
                                                                        {stops.map((st) => {
                                                                            const statOrder = [
                                                                                'arrival_time',
                                                                                'departure_time',
                                                                                'service_time',
                                                                                'waiting_time',
                                                                                'arrival_distance',
                                                                                'departure_distance',
                                                                                'arrival_cost',
                                                                                'departure_cost',
                                                                                'demand',
                                                                                'load',
                                                                                'arrival_capacity',
                                                                                'departure_capacity',
                                                                                'time_window_violation'
                                                                            ];
                                                                            const label = (k) => k.replace(/_/g, ' ');
                                                                            const tooltip = (
                                                                                <Box sx={{ p: 0.5 }}>
                                                                                    <Grid container spacing={1} sx={{ maxWidth: 360 }}>
                                                                                        {statOrder.map((k) => {
                                                                                            const v = st[k];
                                                                                            if (v === null || v === undefined) return null;
                                                                                            const val =
                                                                                                typeof v === 'number'
                                                                                                    ? Number(v).toFixed(2)
                                                                                                    : String(v);
                                                                                            return (
                                                                                                <Grid item xs={6} key={k}>
                                                                                                    <Typography
                                                                                                        variant="caption"
                                                                                                        color="inherit"
                                                                                                    >
                                                                                                        {label(k)}: {val}
                                                                                                    </Typography>
                                                                                                </Grid>
                                                                                            );
                                                                                        })}
                                                                                    </Grid>
                                                                                </Box>
                                                                            );
                                                                            return (
                                                                                <Tooltip
                                                                                    key={`${r.key}-${st.node_id}-${st.sequence}`}
                                                                                    title={tooltip}
                                                                                    placement="right"
                                                                                    arrow
                                                                                >
                                                                                    <ListItem sx={{ py: 0.4 }}>
                                                                                        <ListItemText
                                                                                            primary={
                                                                                                <Typography variant="caption">
                                                                                                    Stop #{st.sequence} (node {st.node_id})
                                                                                                </Typography>
                                                                                            }
                                                                                        />
                                                                                    </ListItem>
                                                                                </Tooltip>
                                                                            );
                                                                        })}
                                                                    </List>
                                                                </Collapse>
                                                            </Box>
                                                        );
                                                    })}
                                                </Stack>
                                            </Collapse>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Box>
                    )}
                </Box>

                {/* Right canvas area */}
                <Box sx={{ position: 'relative', width: '100%', height }}>
                    {!splitMode && (
                        <>
                            <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height }} />
                            <div ref={overlayRef} style={{ position: 'absolute', inset: 0, cursor: 'grab' }} />
                        </>
                    )}
                    {splitMode && (
                        <Stack direction="column" spacing={1} sx={{ height: '100%', overflow: 'auto' }}>
                            {selectedSolutions.map((sid, idx) => (
                                <SplitSolutionCanvas
                                    key={sid}
                                    sid={sid}
                                    nodesById={nodesById}
                                    links={links}
                                    solution={allSolutions[sid]}
                                    instanceMode={mode}
                                    showNodes={showNodes}
                                    showLinks={showLinks}
                                    showRoutes={showRoutes}
                                    perRouteColors={perRouteColors}
                                    visibleRoutes={visibleRoutes}
                                    routeColorScale={routeColorBySolution[sid] || d3.scaleOrdinal(d3.schemeTableau10)}
                                    solutionColor={defaultColors[idx % defaultColors.length]}
                                    hoveredRoute={hoveredRoute}
                                    projection={projection}
                                    xyScales={xyScales}
                                    height={Math.max(260, Math.floor(height / Math.min(3, selectedSolutions.length)))}
                                />
                            ))}
                        </Stack>
                    )}
                </Box>
            </Stack>
            <Divider sx={{ my: 1 }} />
        </Box>
    );
}

function SplitSolutionCanvas({
    sid,
    nodesById,
    links,
    solution,
    instanceMode,
    showNodes,
    showLinks,
    showRoutes,
    perRouteColors,
    visibleRoutes,
    routeColorScale,
    solutionColor,
    projection,
    xyScales,
    height,
    hoveredRoute
}) {
    const canvasRef = React.useRef(null);
    const overlayRef = React.useRef(null);
    const [transform, setTransform] = React.useState(d3.zoomIdentity);

    const projectPoint = (node) => {
        if (instanceMode === 'geo') {
            const p = projection([node.lng, node.lat]);
            return p ? { x: p[0], y: p[1] } : { x: 0, y: 0 };
        }
        return { x: xyScales.x(node.x), y: xyScales.y(node.y) };
    };

    useEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;
        const zoom = d3
            .zoom()
            .scaleExtent([0.2, 40])
            .on('zoom', (e) => setTransform(e.transform));
        const sel = d3.select(overlay);
        sel.call(zoom);
        return () => sel.on('.zoom', null);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.parentElement?.clientWidth || 600;
        canvas.width = width;
        canvas.height = height;
        ctx.save();
        ctx.clearRect(0, 0, width, height);
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);

        if (showLinks && links?.length) {
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = '#9e9e9e';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (const e of links) {
                const s = nodesById.get(e.source);
                const t = nodesById.get(e.target);
                if (!s || !t) continue;
                const ps = projectPoint(s);
                const pt = projectPoint(t);
                ctx.moveTo(ps.x, ps.y);
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
            ctx.closePath();
        }

        if (showRoutes && solution) {
            const visSet = new Set(visibleRoutes[sid] || []);
            ctx.globalAlpha = 0.95;
            ctx.lineWidth = 1.6;
            for (let rIndex = 0; rIndex < (solution.routes || []).length; rIndex++) {
                const route = solution.routes[rIndex];
                const rKey = String(route.id ?? `${sid}-${rIndex}`);
                if (visSet.size && !visSet.has(rKey)) continue;
                const isHovered = hoveredRoute && hoveredRoute.sid === sid && hoveredRoute.key === rKey;
                const color = perRouteColors ? routeColorScale(rKey) : solutionColor || '#1976d2';
                ctx.strokeStyle = color;
                ctx.globalAlpha = hoveredRoute && hoveredRoute.sid === sid ? (isHovered ? 1.0 : 0.2) : 0.95;
                ctx.lineWidth = isHovered ? 2.4 : 1.6;
                const stops = [...(route.stops || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
                if (stops.length < 2) continue;
                ctx.beginPath();
                for (let i = 0; i < stops.length - 1; i++) {
                    const s = nodesById.get(stops[i].node_id);
                    const t = nodesById.get(stops[i + 1].node_id);
                    if (!s || !t) continue;
                    const ps = projectPoint(s);
                    const pt = projectPoint(t);
                    ctx.moveTo(ps.x, ps.y);
                    ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
                ctx.closePath();
            }
        }

        if (showNodes && nodesById.size) {
            ctx.globalAlpha = 0.95;
            for (const n of nodesById.values()) {
                const { x, y } = projectPoint(n);
                const isDepot = n.isDepot || n.type === 'depot' || n.category === 'depot';
                ctx.fillStyle = isDepot ? '#d32f2f' : '#1976d2';
                ctx.beginPath();
                ctx.arc(x, y, isDepot ? 3.5 : 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.closePath();
            }
        }

        ctx.restore();
    }, [
        sid,
        nodesById,
        links,
        solution,
        instanceMode,
        showNodes,
        showLinks,
        showRoutes,
        perRouteColors,
        visibleRoutes,
        routeColorScale,
        transform,
        projection,
        xyScales,
        height,
        hoveredRoute
    ]);

    return (
        <Box sx={{ position: 'relative', width: '100%', height }}>
            <canvas ref={canvasRef} height={height} style={{ width: '100%', height }} />
            <div ref={overlayRef} style={{ position: 'absolute', inset: 0, cursor: 'grab' }} />
        </Box>
    );
}

export default D3SolutionVisualizer;
