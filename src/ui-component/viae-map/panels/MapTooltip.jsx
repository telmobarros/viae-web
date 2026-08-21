/**
 * Lightweight hover preview: identity + a couple of headline metrics.
 *
 * Deliberately not the full inspector -- that is what click-to-pin is for
 * (see selection/useSelection.js). This follows the cursor and must stay
 * cheap to render, since it re-renders on every rAF-throttled hover tick.
 */
import { Paper, Typography } from '@mui/material';

/**
 * @param {{ node: Object|null, pos: [number, number]|null }} props
 */
export default function MapTooltip({ node, pos }) {
    if (!node || !pos) return null;
    const props = node.props || {};

    return (
        <Paper
            elevation={4}
            sx={{
                position: 'absolute',
                left: pos[0] + 12,
                top: pos[1] + 12,
                zIndex: 3,
                px: 1,
                py: 0.5,
                pointerEvents: 'none',
                borderRadius: 1,
                maxWidth: 220
            }}
        >
            <Typography variant="caption" display="block" fontWeight={600}>
                {node.kind === 'depot' ? 'Depot' : node.kind === 'station' ? 'Station' : 'Node'} #{node.id}
            </Typography>
            {Number.isFinite(props.lat) && Number.isFinite(props.lng) && (
                <Typography variant="caption" display="block" color="text.secondary">
                    {props.lat.toFixed(5)}, {props.lng.toFixed(5)}
                </Typography>
            )}
            {Number.isFinite(props.x) && Number.isFinite(props.y) && (
                <Typography variant="caption" display="block" color="text.secondary">
                    ({props.x.toFixed(2)}, {props.y.toFixed(2)}
                    {Number.isFinite(props.z) ? `, ${props.z.toFixed(2)}` : ''})
                </Typography>
            )}
        </Paper>
    );
}
