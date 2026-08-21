/**
 * Floating bottom-left legend: node-kind swatches.
 *
 * Route swatches join this once routes exist as a layer (Phase 5); until
 * then a legend with entries for a layer that isn't drawn yet would be
 * exactly the kind of speculative UI this refactor is trying to avoid.
 */
import { Box, Paper, Stack, Typography } from '@mui/material';

import { NODE_COLORS, cssColor } from '../palette';

const ENTRIES = [
    { kind: 'depot', label: 'Depot' },
    { kind: 'station', label: 'Station' },
    { kind: 'customer', label: 'Customer' }
];

export default function MapLegend({ nodes }) {
    const counts = new Map();
    (nodes || []).forEach((n) => counts.set(n.kind, (counts.get(n.kind) || 0) + 1));
    const entries = ENTRIES.filter((e) => counts.has(e.kind));
    if (!entries.length) return null;

    return (
        <Paper
            elevation={3}
            sx={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                zIndex: 2,
                p: 1,
                borderRadius: 2,
                backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.9)')
            }}
        >
            <Stack spacing={0.5}>
                {entries.map((e) => (
                    <Stack key={e.kind} direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cssColor(NODE_COLORS[e.kind]) }} />
                        <Typography variant="caption">
                            {e.label} ({counts.get(e.kind).toLocaleString()})
                        </Typography>
                    </Stack>
                ))}
            </Stack>
        </Paper>
    );
}
