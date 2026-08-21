/**
 * Compact, scrollable route list -- show/hide individual routes, show/hide
 * all, click a row to select. Deliberately NOT an always-expanded control
 * surface: an instance with dozens of routes gets a fixed-height scroll
 * region instead of pushing the rest of the inspector off-screen (explicit
 * Phase 5 requirement).
 */
import { Box, Checkbox, Stack, Tooltip, Typography } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { routeKey } from '../model';
import { cssColor } from '../palette';

const MAX_LIST_HEIGHT = 220;

export default function RouteList({ routes, visibleKeys, onToggleVisibility, onShowAll, onHideAll, selection, onSelectRoute }) {
    if (!routes || !routes.length) {
        return (
            <Typography variant="caption" color="text.secondary">
                This solution has no routes.
            </Typography>
        );
    }

    return (
        <Box>
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="primary" sx={{ cursor: 'pointer' }} onClick={onShowAll}>
                    Show all
                </Typography>
                <Typography variant="caption" color="primary" sx={{ cursor: 'pointer' }} onClick={onHideAll}>
                    Hide all
                </Typography>
            </Stack>
            <Box sx={{ maxHeight: MAX_LIST_HEIGHT, overflowY: 'auto', pr: 0.5 }}>
                <Stack spacing={0.25}>
                    {routes.map((r) => {
                        const key = routeKey(r.solutionId, r.id);
                        const visible = !visibleKeys || visibleKeys.has(key);
                        const isSelected =
                            selection && selection.kind === 'route' && selection.routeId === r.id && selection.solutionId === r.solutionId;
                        const hasGap = r.missingNodes > 0;
                        return (
                            <Stack
                                key={key}
                                direction="row"
                                spacing={0.75}
                                alignItems="center"
                                onClick={() => onSelectRoute(r)}
                                sx={{
                                    cursor: 'pointer',
                                    borderRadius: 1,
                                    px: 0.5,
                                    py: 0.25,
                                    backgroundColor: isSelected ? 'action.selected' : 'transparent',
                                    '&:hover': { backgroundColor: 'action.hover' }
                                }}
                            >
                                <Box
                                    sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cssColor(r.color), flexShrink: 0 }}
                                />
                                <Typography variant="caption" sx={{ minWidth: 26 }}>
                                    {r.label}
                                </Typography>
                                {r.vehicleId != null && (
                                    <Typography variant="caption" color="text.secondary">
                                        veh {r.vehicleId}
                                    </Typography>
                                )}
                                <Typography variant="caption" color="text.secondary">
                                    {r.metrics.nStops ?? r.stops.length} stops
                                </Typography>
                                {Number.isFinite(r.metrics.distance) && (
                                    <Typography variant="caption" color="text.secondary">
                                        {r.metrics.distance.toFixed(1)}
                                    </Typography>
                                )}
                                {hasGap && (
                                    <Tooltip
                                        title={`${r.missingCoordinates} stop(s) with no coordinates${r.missingFromPayload ? `, ${r.missingFromPayload} missing from the payload` : ''}`}
                                    >
                                        <WarningAmberIcon fontSize="inherit" color={r.missingFromPayload ? 'error' : 'warning'} />
                                    </Tooltip>
                                )}
                                <Box sx={{ flexGrow: 1 }} />
                                <Checkbox
                                    size="small"
                                    checked={visible}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => onToggleVisibility(r)}
                                    icon={<VisibilityOffIcon fontSize="small" />}
                                    checkedIcon={<VisibilityIcon fontSize="small" />}
                                    sx={{ p: 0.25 }}
                                />
                            </Stack>
                        );
                    })}
                </Stack>
            </Box>
        </Box>
    );
}
