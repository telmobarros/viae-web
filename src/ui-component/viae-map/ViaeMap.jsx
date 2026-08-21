/**
 * Shared presentational visualizer core.
 *
 * Renders one canonical `Scene` (see ./model.js) across geographic /
 * Euclidean-2D / Euclidean-3D space, resolving the deck.gl View, fitting the
 * viewport, mounting a theme-aware basemap only where it is meaningful, and
 * wiring hover-preview / click-to-pin picking. It owns projection, layers
 * and picking; it never fetches -- the container passes in a `Scene` and
 * gets a selection back.
 *
 * Phase 5 extends node-only rendering (Phase 3) with solutions/routes/stops/
 * links and the inspector drawer. Picking is wired at the <DeckGL> level
 * (onHover/onClick), not per-layer -- with nodes, routes and route-stops all
 * potentially coincident at one pixel, only the top-level callback reports a
 * single unambiguous topmost hit (via `info.layer.id`); see
 * layers/nodesLayer.js's docstring for why per-layer callbacks were dropped.
 * Layer draw order (bottom to top: basemap, links, nodes, routes, stops)
 * IS the picking-precedence decision.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Alert, Box, Skeleton, useTheme } from '@mui/material';

import { assertScene } from './adapters/assertScene';
import { buildBasemapLayer } from './layers/basemapLayer';
import { buildLinksLayer } from './layers/linksLayer';
import { buildNodesLayer } from './layers/nodesLayer';
import { buildRoutesLayer } from './layers/routesLayer';
import { buildRouteStopsLayer } from './layers/routeStopsLayer';
import InspectorDrawer from './panels/InspectorDrawer';
import MapLegend from './panels/MapLegend';
import MapToolbar from './panels/MapToolbar';
import MapTooltip from './panels/MapTooltip';
import { useHover } from './picking/useHover';
import { useRouteVisibility } from './selection/useRouteVisibility';
import { useSelection } from './selection/useSelection';
import { bboxOf } from './scale/budget';
import { routePositions, solutionPositions } from './scale/geometry';
import { fitBoundsForView } from './view/fitBounds';
import { resolveView, spaceMode } from './view/resolveView';

const DEFAULT_HEIGHT = 420;
const DEFAULT_WIDTH = 600;

/**
 * @param {Object} props
 * @param {import('./model').Scene|null} props.scene
 * @param {number} [props.height]
 * @param {boolean} [props.loading]
 * @param {string|null} [props.error]
 * @param {Object} [props.selection] controlled selection ({kind, ...}, see useSelection)
 * @param {(selection: Object|null) => void} [props.onSelectionChange]
 * @param {{tooltip?: React.ComponentType}} [props.slots]
 * @param {string} [props.emptyMessage] overrides the default empty-state text
 */
export default function ViaeMap({
    scene,
    height = DEFAULT_HEIGHT,
    loading = false,
    error = null,
    selection: controlledSelection,
    onSelectionChange,
    slots = {},
    emptyMessage
}) {
    const theme = useTheme();
    const themeMode = theme.palette.mode === 'dark' ? 'dark' : 'light';

    const containerRef = useRef(null);
    const [size, setSize] = useState({ width: DEFAULT_WIDTH, height });

    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width: w, height: h } = entry.contentRect;
            if (w > 0 && h > 0) setSize({ width: Math.round(w), height: Math.round(h) });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const mode = spaceMode(scene?.space);
    const view = useMemo(() => resolveView(mode), [mode]);

    const [viewState, setViewState] = useState(null);

    // Re-fit to the FULL scene when the data identity or the spatial mode
    // changes, but not on every container resize -- a user's pan/zoom should
    // survive a panel being dragged, and survive re-fetches of the SAME data
    // (e.g. a live poll) rather than snapping back every few seconds. This
    // is the "Fit all" baseline; the toolbar's Fit button becomes
    // context-aware separately (see `fit` below).
    const sceneKey = scene ? `${scene.source?.endpoint || ''}:${scene.source?.fetchedAt || ''}` : null;
    useEffect(() => {
        if (!scene) return;
        setViewState(fitBoundsForView(scene.space, scene.bbox, size));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sceneKey, mode]);

    useEffect(() => {
        if (scene) assertScene(scene, { basemapMounted: mode === 'geo' });
    }, [scene, mode]);

    const solutions = scene?.solutions || [];
    const [activeSolutionId, setActiveSolutionId] = useState(null);
    // Falls back to the first solution automatically whenever the explicitly
    // chosen id doesn't match a solution currently in the Scene (covers both
    // "nothing chosen yet" and "a new fetch no longer has that id") without a
    // separate reset effect.
    const activeSolution = useMemo(
        () => solutions.find((s) => s.id === activeSolutionId) || solutions[0] || null,
        [solutions, activeSolutionId]
    );
    const activeRoutes = activeSolution ? activeSolution.routes : [];

    const { visibleKeys, toggle: toggleRouteVisibility, showAll, hideAll } = useRouteVisibility(activeRoutes);

    const { hovered, hoveredLayerId, hoverPos, onHover } = useHover();
    const {
        selection,
        onClick,
        clear: clearSelection,
        selectRoute
    } = useSelection({
        selection: controlledSelection,
        onChange: onSelectionChange
    });

    const hoveredRouteId =
        hoveredLayerId === 'viae-map-routes' || hoveredLayerId === 'viae-map-route-stops' ? hovered && hovered.routeId : null;
    const selectedRouteId = selection && (selection.kind === 'route' || selection.kind === 'stop') ? selection.routeId : null;
    const hoveredStop = hoveredLayerId === 'viae-map-route-stops' ? { routeId: hovered.routeId, nodeId: hovered.stop.nodeId } : null;
    const selectedStop = selection && selection.kind === 'stop' ? { routeId: selection.routeId, nodeId: selection.nodeId } : null;
    const hoveredNodeId = hoveredLayerId === 'viae-map-nodes' ? hovered && hovered.id : null;
    const selectedNodeId = selection && selection.kind === 'node' ? selection.nodeId : null;
    // Cheap, stable string keys for the useMemo dep array below -- hoveredStop/
    // selectedStop are plain-object literals recreated every render, so using
    // them directly as deps would defeat the layers memo entirely (a new
    // reference every time, even when the underlying value is unchanged).
    const hoveredStopKey = hoveredStop ? `${hoveredStop.routeId}:${hoveredStop.nodeId}` : null;
    const selectedStopKey = selectedStop ? `${selectedStop.routeId}:${selectedStop.nodeId}` : null;

    // Fit target follows selection specificity: a selected route (or its
    // selected stop) fits to just that route, otherwise the active
    // solution's routes, otherwise the whole scene -- so selecting a route
    // in a huge node-overview scene doesn't leave the user looking at it
    // from country-scale (explicit Phase 5 requirement). One button, not
    // three, per the "capable of fitting meaningful subsets" instruction.
    const selectedRouteObj = selectedRouteId != null ? activeRoutes.find((r) => r.id === selectedRouteId) : null;
    const fit = useCallback(() => {
        if (!scene) return;
        let bbox = scene.bbox;
        if (selectedRouteObj) {
            bbox = bboxOf(routePositions(selectedRouteObj));
        } else if (activeSolution && activeSolution.routes.length) {
            bbox = bboxOf(solutionPositions(activeSolution));
        }
        setViewState(fitBoundsForView(scene.space, bbox, size));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene, size, selectedRouteObj, activeSolution]);

    const layers = useMemo(() => {
        if (!scene) return [];
        const basemap = buildBasemapLayer(mode, themeMode);
        const links = buildLinksLayer({ links: scene.links, nodeIndex: scene.nodeIndex, themeMode });
        const nodes = buildNodesLayer({
            nodes: scene.nodes,
            spaceMode: mode,
            hoveredId: hoveredNodeId,
            selectedId: selectedNodeId,
            themeMode
        });
        const routes = buildRoutesLayer({ routes: activeRoutes, visibleKeys, hoveredRouteId, selectedRouteId });
        const routeStops = buildRouteStopsLayer({
            routes: activeRoutes,
            spaceMode: mode,
            visibleKeys,
            hoveredStop,
            selectedStop
        });
        return [basemap, links, nodes, routes, routeStops].filter(Boolean);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        scene,
        mode,
        themeMode,
        activeRoutes,
        visibleKeys,
        hoveredNodeId,
        selectedNodeId,
        hoveredRouteId,
        selectedRouteId,
        hoveredStopKey,
        selectedStopKey
    ]);

    const [inspectorOpen, setInspectorOpen] = useState(true);
    const TooltipSlot = slots.tooltip || MapTooltip;
    // A Scene with zero nodes is not "no data to render yet", it's "there is
    // nothing to plot" -- mounting an empty deck.gl canvas over it would be
    // worse than a plain message (fitBoundsForView also has no real extent to
    // work with here, per its own degenerate-bbox fallback). Distinguish "the
    // instance genuinely has no nodes" from "it has nodes but none placeable
    // in this space" using the adapter-reported skip count, same distinction
    // the previous per-widget code made locally.
    const isEmpty = scene && scene.nodes.length === 0 && activeRoutes.length === 0;
    const defaultEmptyMessage =
        scene && scene.budget && scene.budget.skippedNoCoords > 0
            ? 'No node has usable coordinates in this space.'
            : 'No nodes to display.';
    const showCanvas = !loading && !error && scene && !isEmpty && viewState;

    return (
        <Box ref={containerRef} sx={{ position: 'relative', width: '100%', height, overflow: 'hidden', borderRadius: 1 }}>
            {loading && <Skeleton variant="rectangular" width="100%" height={height} sx={{ borderRadius: 1 }} />}
            {!loading && error && (
                <Alert severity="error" sx={{ position: 'absolute', inset: 0 }}>
                    {error}
                </Alert>
            )}
            {!loading && !error && (!scene || isEmpty) && (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        color: 'text.secondary'
                    }}
                >
                    {emptyMessage || (scene ? defaultEmptyMessage : 'No data to display')}
                </Box>
            )}
            {showCanvas && (
                <>
                    <DeckGL
                        style={{ position: 'relative', width: '100%', height: '100%' }}
                        views={view}
                        controller
                        viewState={viewState}
                        layers={layers}
                        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
                        onHover={onHover}
                        onClick={onClick}
                    />
                    <MapToolbar mode={mode} budget={scene.budget} onFit={fit} />
                    <MapLegend nodes={scene.nodes} />
                    <TooltipSlot node={hovered} pos={hoverPos} layerId={hoveredLayerId} />
                    {solutions.length > 0 && (
                        <InspectorDrawer
                            scene={scene}
                            activeSolutionId={activeSolution && activeSolution.id}
                            onSelectActiveSolution={setActiveSolutionId}
                            visibleKeys={visibleKeys}
                            onToggleVisibility={toggleRouteVisibility}
                            onShowAll={showAll}
                            onHideAll={hideAll}
                            selection={selection}
                            onSelectRoute={selectRoute}
                            onClearSelection={clearSelection}
                            open={inspectorOpen}
                            onToggleOpen={() => setInspectorOpen((v) => !v)}
                        />
                    )}
                </>
            )}
        </Box>
    );
}
