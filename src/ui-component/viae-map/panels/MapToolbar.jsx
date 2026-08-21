/**
 * Floating top-left toolbar: space-mode indicator, fit/reset, budget chip.
 *
 * Floats over the canvas rather than pushing it down -- the map-first layout
 * called for in the plan, replacing the form-row-above-a-small-map pattern
 * every current visualizer uses.
 */
import { Box, Chip, IconButton, Paper, Stack, Tooltip } from '@mui/material';
import GridOnIcon from '@mui/icons-material/GridOn';
import PublicIcon from '@mui/icons-material/Public';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';

import { MODE_LABEL, SpaceMode } from '../view/resolveView';

const MODE_ICON = {
    [SpaceMode.GEO]: PublicIcon,
    [SpaceMode.PLANE_2D]: GridOnIcon,
    [SpaceMode.PLANE_3D]: ViewInArIcon
};

/**
 * @param {{ mode: string, budget: Object, onFit: () => void, extra?: React.ReactNode }} props
 */
export default function MapToolbar({ mode, budget, onFit, extra }) {
    const ModeIcon = MODE_ICON[mode] || GridOnIcon;
    const showBudgetChip = budget && Number.isFinite(budget.total) && budget.total > budget.returned;

    return (
        <Paper
            elevation={3}
            sx={{
                position: 'absolute',
                top: 12,
                left: 12,
                zIndex: 2,
                p: 0.75,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderRadius: 2,
                backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.9)')
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" icon={<ModeIcon fontSize="small" />} label={MODE_LABEL[mode] || mode} />
                <Tooltip title="Fit to data">
                    <IconButton size="small" onClick={onFit} aria-label="Fit to data">
                        <CenterFocusStrongIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                {showBudgetChip && (
                    <Tooltip
                        title={`Server sampled ${budget.returned.toLocaleString()} of ${budget.total.toLocaleString()} for a representative overview`}
                    >
                        <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label={`Showing ${budget.returned.toLocaleString()} of ${budget.total.toLocaleString()}`}
                        />
                    </Tooltip>
                )}
                {extra ? <Box>{extra}</Box> : null}
            </Stack>
        </Paper>
    );
}
