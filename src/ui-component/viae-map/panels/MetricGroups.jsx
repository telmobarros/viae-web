/**
 * Renders a canonicalized metrics object grouped via model.js's
 * groupMetrics/METRIC_SPEC -- the one place that turns a Scene metrics
 * object into UI, shared by the solution/route/stop inspector contexts so
 * grouping/formatting/severity styling stays consistent across all three.
 *
 * groupMetrics already treats 0/0.0/false as present values (it only skips
 * undefined/null), so a genuine zero renders as "0", not as a missing row --
 * this component must not add its own truthiness check on top that would
 * undo that.
 */
import { Box, Chip, Divider, Stack, Typography } from '@mui/material';

import { groupMetrics } from '../model';

export default function MetricGroups({ metrics }) {
    const groups = groupMetrics(metrics);
    if (!groups.length) {
        return (
            <Typography variant="caption" color="text.secondary">
                No metrics available.
            </Typography>
        );
    }

    return (
        <Stack spacing={1.5}>
            {groups.map((g) => (
                <Box key={g.key}>
                    <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                        {g.label}
                    </Typography>
                    <Divider sx={{ mb: 0.5 }} />
                    <Stack spacing={0.4}>
                        {g.items.map((item) => (
                            <Stack key={item.key} direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" color="text.secondary">
                                    {item.label}
                                </Typography>
                                {item.severity ? (
                                    <Chip
                                        size="small"
                                        color={item.severity === 'error' ? 'error' : 'default'}
                                        label={item.display}
                                        sx={{ height: 18, fontSize: '0.68rem' }}
                                    />
                                ) : (
                                    <Typography variant="caption" fontWeight={600}>
                                        {item.display}
                                    </Typography>
                                )}
                            </Stack>
                        ))}
                    </Stack>
                </Box>
            ))}
        </Stack>
    );
}
