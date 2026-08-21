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
 * Deliberately scoped to what Phase 3 delivers: node rendering, not yet
 * routes/links/unserved (Phase 5) or an inspector drawer (also Phase 5).
 * Extending the prop surface for those before they exist would be exactly
 * the speculative abstraction this refactor is meant to avoid.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Alert, Box, Skeleton, useTheme } from '@mui/material';

import { assertScene } from './adapters/assertScene';
import { buildBasemapLayer } from './layers/basemapLayer';
import { buildNodesLayer } from './layers/nodesLayer';
import MapLegend from './panels/MapLegend';
import MapToolbar from './panels/MapToolbar';
import MapTooltip from './panels/MapTooltip';
import { useHover } from './picking/useHover';
import { useSelection } from './selection/useSelection';
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
 * @param {{nodeId?: (number|string|null)}} [props.selection] controlled node selection
 * @param {(nodeId: number|string|null) => void} [props.onSelectionChange]
 * @param {{tooltip?: React.ComponentType}} [props.slots]
 * @param {string} [props.emptyMessage] overrides the default empty-state text
 */
export default function ViaeMap({
    scene,
    height = DEFAULT_HEIGHT,
    loading = false,
    error = null,
    selection,
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
    const fit = useCallback(() => {
        if (!scene) return;
        setViewState(fitBoundsForView(scene.space, scene.bbox, size));
    }, [scene, size]);

    // Re-fit when the data identity or the spatial mode changes, but not on
    // every container resize -- a user's pan/zoom should survive a panel
    // being dragged, and should survive re-fetches of the SAME data (e.g. a
    // live poll) rather than snapping back every few seconds.
    const sceneKey = scene ? `${scene.source?.endpoint || ''}:${scene.source?.fetchedAt || ''}` : null;
    useEffect(() => {
        if (!scene) return;
        setViewState(fitBoundsForView(scene.space, scene.bbox, size));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sceneKey, mode]);

    useEffect(() => {
        if (scene) assertScene(scene, { basemapMounted: mode === 'geo' });
    }, [scene, mode]);

    const { hovered, hoverPos, onHover } = useHover();
    const { selectedId, onClick } = useSelection({ nodeId: selection?.nodeId, onChange: onSelectionChange });

    const layers = useMemo(() => {
        if (!scene) return [];
        const basemap = buildBasemapLayer(mode, themeMode);
        const nodes = buildNodesLayer({
            nodes: scene.nodes,
            spaceMode: mode,
            hoveredId: hovered ? hovered.id : null,
            selectedId,
            themeMode,
            onHover,
            onClick
        });
        return [basemap, nodes].filter(Boolean);
    }, [scene, mode, themeMode, hovered, selectedId, onHover, onClick]);

    const TooltipSlot = slots.tooltip || MapTooltip;
    // A Scene with zero nodes is not "no data to render yet", it's "there is
    // nothing to plot" -- mounting an empty deck.gl canvas over it would be
    // worse than a plain message (fitBoundsForView also has no real extent to
    // work with here, per its own degenerate-bbox fallback). Distinguish "the
    // instance genuinely has no nodes" from "it has nodes but none placeable
    // in this space" using the adapter-reported skip count, same distinction
    // the previous per-widget code made locally.
    const isEmpty = scene && scene.nodes.length === 0;
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
                    />
                    <MapToolbar mode={mode} budget={scene.budget} onFit={fit} />
                    <MapLegend nodes={scene.nodes} />
                    <TooltipSlot node={hovered} pos={hoverPos} />
                </>
            )}
        </Box>
    );
}
