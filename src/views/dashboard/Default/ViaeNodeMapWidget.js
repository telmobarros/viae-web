/**
 * Dashboard node map, on the shared ViaeMap core.
 *
 * Replaces NodeMapWidget.js's three independent renderers (Leaflet, D3 SVG,
 * a second private deck.gl OrbitView) with one component reused across every
 * visualizer this refactor touches. This file is the container: it owns
 * fetching, the node-limit control, and page-level state; ViaeMap owns
 * projection, layers and picking and never fetches, per the plan's
 * container/presentational split.
 */
import { useEffect, useState } from 'react';
import { Box, MenuItem, Select, Stack, Typography } from '@mui/material';

import MainCard from 'ui-component/cards/MainCard';
import ViaeMap from 'ui-component/viae-map/ViaeMap';
import { fromInstanceNodes } from 'ui-component/viae-map/adapters';
import authAxios from 'utils/axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const MAP_HEIGHT = 400;

// Same render budget as before: one marker per node means a 50k-node
// instance can freeze or kill the browser tab, so both ends of the wire cap
// the count. Unchanged from NodeMapWidget.js -- Phase 4 migrates the
// renderer, not the budget policy.
const NODE_LIMIT_OPTIONS = [500, 2000, 5000, 10000];
const DEFAULT_NODE_LIMIT = 2000;

const ViaeNodeMapWidget = ({ instance }) => {
    const [scene, setScene] = useState(null);
    const [nodeLimit, setNodeLimit] = useState(DEFAULT_NODE_LIMIT);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!instance?.id) return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);
        authAxios
            .get(`${API_BASE}/api/v1/dataset_instances/${instance.id}/nodes`, { params: { limit: nodeLimit } })
            .then((res) => {
                if (cancelled) return;
                const result = res?.data?.result;
                if (!result) throw new Error('Empty response');
                setScene(fromInstanceNodes(result, { endpoint: `dataset_instances/${instance.id}/nodes` }));
            })
            .catch((e) => {
                if (!cancelled) setError(e?.message || 'Failed to load nodes');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [instance?.id, nodeLimit]);

    const cardTitle = (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="h4">Node Map</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                    Max nodes
                </Typography>
                <Select
                    value={nodeLimit}
                    onChange={(e) => setNodeLimit(Number(e.target.value))}
                    size="small"
                    variant="outlined"
                    SelectDisplayProps={{ 'data-testid': 'viae-node-limit-select' }}
                    sx={{ height: 26, fontSize: '0.72rem', '& .MuiSelect-select': { py: 0.25 } }}
                >
                    {NODE_LIMIT_OPTIONS.map((opt) => (
                        <MenuItem key={opt} value={opt} data-testid={`viae-node-limit-option-${opt}`} sx={{ fontSize: '0.78rem' }}>
                            {opt.toLocaleString()}
                        </MenuItem>
                    ))}
                </Select>
            </Stack>
        </Stack>
    );

    return (
        <MainCard title={cardTitle} content={false} sx={{ overflow: 'hidden' }}>
            <Box sx={{ px: 2, pb: 2, pt: 1.5 }}>
                <ViaeMap scene={scene} height={MAP_HEIGHT} loading={loading} error={error} />
            </Box>
        </MainCard>
    );
};

export default ViaeNodeMapWidget;
