/**
 * Lightweight hover preview: identity + a couple of headline metrics.
 *
 * Deliberately not the full inspector -- that is what click-to-pin is for
 * (see selection/useSelection.js). This follows the cursor and must stay
 * cheap to render, since it re-renders on every rAF-throttled hover tick.
 *
 * Content is picked by `layerId` (which layer deck.gl reported as hit),
 * same precedence source as selection -- never guessed from the object's
 * shape.
 */
import { Paper, Typography } from '@mui/material';

function NodePreview({ node }) {
    const props = node.props || {};
    return (
        <>
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
        </>
    );
}

function StopPreview({ row }) {
    const m = (row.stop && row.stop.metrics) || {};
    return (
        <>
            <Typography variant="caption" display="block" fontWeight={600}>
                Node #{row.stop.nodeId} &middot; {row.routeLabel} &middot; seq {row.stop.sequence}
            </Typography>
            {Number.isFinite(m.arrivalTime) && (
                <Typography variant="caption" display="block" color="text.secondary">
                    Arrival {m.arrivalTime.toFixed(1)}
                </Typography>
            )}
        </>
    );
}

function RoutePreview({ row }) {
    const r = row.route;
    const dist = r && r.metrics && r.metrics.distance;
    return (
        <>
            <Typography variant="caption" display="block" fontWeight={600}>
                {r ? r.label : 'Route'}
                {r && r.vehicleId != null ? ` · vehicle ${r.vehicleId}` : ''}
            </Typography>
            {Number.isFinite(dist) && (
                <Typography variant="caption" display="block" color="text.secondary">
                    Distance {dist.toFixed(1)}
                </Typography>
            )}
        </>
    );
}

/**
 * @param {{ node: Object|null, pos: [number, number]|null, layerId?: string|null }} props
 */
export default function MapTooltip({ node, pos, layerId }) {
    if (!node || !pos) return null;

    let content;
    if (layerId === 'viae-map-route-stops') content = <StopPreview row={node} />;
    else if (layerId === 'viae-map-routes') content = <RoutePreview row={node} />;
    else content = <NodePreview node={node} />;

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
            {content}
        </Paper>
    );
}
