/**
 * Modern inspector drawer: context-aware content driven entirely by
 * `selection` (see selection/useSelection.js) plus the always-present
 * solution summary + route list.
 *
 * A floating Paper anchored to the right edge of the map container, sized
 * to the container rather than the viewport -- matching MapToolbar/
 * MapLegend's existing floating-panel pattern (Phase 3) rather than MUI's
 * viewport-anchored Drawer, since ViaeMap must stay embeddable inside a
 * dashboard card, not assume it owns the page.
 */
import { useMemo } from 'react';
import { Box, Chip, Divider, IconButton, Paper, Stack, Switch, Tooltip, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

import { LinkStatus } from '../model';
import { cssColor } from '../palette';
import MetricGroups from './MetricGroups';
import RouteList from './RouteList';

const WIDTH = 320;

const LINK_STATUS_LABEL = {
    [LinkStatus.OK]: 'Links: complete',
    [LinkStatus.TRUNCATED]: 'Links: truncated',
    [LinkStatus.ERROR]: 'Links: unavailable (error)',
    [LinkStatus.NONE]: 'Links: none',
    [LinkStatus.NOT_REQUESTED]: null // don't clutter the drawer when links were never part of this payload
};

function findRoute(solution, routeId) {
    return (solution && solution.routes.find((r) => r.id === routeId)) || null;
}

function findStop(route, nodeId, sequence) {
    if (!route) return null;
    return route.stops.find((s) => s.nodeId === nodeId && s.sequence === sequence) || null;
}

export default function InspectorDrawer({
    scene,
    activeSolutionId,
    onSelectActiveSolution,
    visibleKeys,
    onToggleVisibility,
    onShowAll,
    onHideAll,
    selection,
    onSelectRoute,
    onClearSelection,
    open,
    onToggleOpen
}) {
    const solutions = scene.solutions || [];
    const activeSolution = useMemo(
        () => solutions.find((s) => s.id === activeSolutionId) || solutions[0] || null,
        [solutions, activeSolutionId]
    );

    const selectedRoute =
        selection && (selection.kind === 'route' || selection.kind === 'stop')
            ? findRoute(solutions.find((s) => s.id === selection.solutionId) || activeSolution, selection.routeId)
            : null;
    const selectedStop = selection && selection.kind === 'stop' ? findStop(selectedRoute, selection.nodeId, selection.sequence) : null;
    const selectedNode = selection && selection.kind === 'node' ? scene.nodeIndex.get(selection.nodeId) : null;

    if (!solutions.length) return null;

    if (!open) {
        return (
            <Tooltip title="Open inspector">
                <IconButton
                    size="small"
                    onClick={onToggleOpen}
                    sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        zIndex: 2,
                        backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.9)')
                    }}
                >
                    <ChevronLeftIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        );
    }

    const linkLabel = scene.links && LINK_STATUS_LABEL[scene.links.status];
    const unservedCount = activeSolution && activeSolution.unserved ? activeSolution.unserved.count : null;

    return (
        <Paper
            elevation={4}
            sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                zIndex: 2,
                width: WIDTH,
                height: '100%',
                overflowY: 'auto',
                p: 1.5,
                boxSizing: 'border-box',
                backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(24,24,24,0.94)' : 'rgba(255,255,255,0.96)')
            }}
        >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Inspector</Typography>
                <IconButton size="small" onClick={onToggleOpen}>
                    <ChevronRightIcon fontSize="small" />
                </IconButton>
            </Stack>

            {solutions.length > 1 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                    {solutions.map((s) => (
                        <Chip
                            key={s.id}
                            size="small"
                            label={s.label}
                            color={activeSolution && s.id === activeSolution.id ? 'primary' : 'default'}
                            onClick={() => onSelectActiveSolution(s.id)}
                        />
                    ))}
                </Stack>
            )}

            {activeSolution && (
                <>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {activeSolution.label}
                    </Typography>
                    <MetricGroups metrics={activeSolution.metrics} />

                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="overline" color="text.secondary">
                        Routes ({activeSolution.routes.length})
                    </Typography>
                    <RouteList
                        routes={activeSolution.routes}
                        visibleKeys={visibleKeys}
                        onToggleVisibility={onToggleVisibility}
                        onShowAll={onShowAll}
                        onHideAll={onHideAll}
                        selection={selection}
                        onSelectRoute={onSelectRoute}
                    />

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                            Unserved: {unservedCount != null ? unservedCount.toLocaleString() : 'n/a'}
                        </Typography>
                        <Tooltip title="Unserved customer geometry isn't available from this endpoint yet -- planned for the scale-backend phase. The count above is authoritative; there is nothing to draw yet.">
                            <span>
                                <Switch size="small" checked={false} disabled />
                            </span>
                        </Tooltip>
                    </Stack>

                    {linkLabel && (
                        <Chip
                            size="small"
                            variant="outlined"
                            color={
                                scene.links.status === LinkStatus.ERROR
                                    ? 'error'
                                    : scene.links.status === LinkStatus.TRUNCATED
                                      ? 'warning'
                                      : 'default'
                            }
                            label={linkLabel}
                            sx={{ mt: 1 }}
                        />
                    )}
                </>
            )}

            {(selectedRoute || selectedStop || selectedNode) && (
                <>
                    <Divider sx={{ my: 1.5 }} />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="overline" color="text.secondary">
                            {selectedStop ? 'Stop' : selectedRoute ? 'Route' : 'Node'}
                        </Typography>
                        <Typography variant="caption" color="primary" sx={{ cursor: 'pointer' }} onClick={onClearSelection}>
                            Clear
                        </Typography>
                    </Stack>

                    {selectedStop && (
                        <>
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                Node #{selectedStop.nodeId} &middot; {selectedRoute.label} &middot; seq {selectedStop.sequence}
                            </Typography>
                            <MetricGroups metrics={selectedStop.metrics} />
                        </>
                    )}

                    {!selectedStop && selectedRoute && (
                        <>
                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cssColor(selectedRoute.color) }} />
                                <Typography variant="body2">
                                    {selectedRoute.label}
                                    {selectedRoute.vehicleId != null ? ` · vehicle ${selectedRoute.vehicleId}` : ''}
                                </Typography>
                            </Stack>
                            {selectedRoute.missingNodes > 0 && (
                                <Typography
                                    variant="caption"
                                    color={selectedRoute.missingFromPayload ? 'error' : 'warning.main'}
                                    sx={{ display: 'block', mb: 0.5 }}
                                >
                                    {selectedRoute.missingCoordinates > 0 &&
                                        `${selectedRoute.missingCoordinates} stop${selectedRoute.missingCoordinates > 1 ? 's have' : ' has'} no coordinates`}
                                    {selectedRoute.missingFromPayload > 0 &&
                                        `${selectedRoute.missingCoordinates > 0 ? '; ' : ''}${selectedRoute.missingFromPayload} missing from the payload entirely`}
                                </Typography>
                            )}
                            <MetricGroups metrics={selectedRoute.metrics} />
                        </>
                    )}

                    {!selectedStop && !selectedRoute && selectedNode && (
                        <>
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                Node #{selectedNode.id} &middot; {selectedNode.kind}
                            </Typography>
                            {/* A background node isn't route-scoped, so it has no
                                METRIC_SPEC-covered metrics of its own -- position is
                                the only thing to show, same fields MapTooltip previews. */}
                            {Number.isFinite(selectedNode.props?.lat) && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    {selectedNode.props.lat.toFixed(5)}, {selectedNode.props.lng.toFixed(5)}
                                </Typography>
                            )}
                            {Number.isFinite(selectedNode.props?.x) && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    ({selectedNode.props.x.toFixed(2)}, {selectedNode.props.y.toFixed(2)}
                                    {Number.isFinite(selectedNode.props.z) ? `, ${selectedNode.props.z.toFixed(2)}` : ''})
                                </Typography>
                            )}
                        </>
                    )}
                </>
            )}
        </Paper>
    );
}
