/**
 * Phase 5 (visualizer refactor) browser-verification page.
 *
 * NOT linked from any menu/navigation and NOT a replacement for the real
 * solver-execution page (views/visualizers/SolutionVisualizer.js) -- that
 * cutover is explicitly reserved for Phase 6's `?engine=` A/B behind a
 * sign-off gate. This is a separate, throwaway-but-reachable route whose
 * only purpose is mounting ViaeMap against real solution payloads through
 * the actual page-rendering stack (real router, real MUI theme, real auth)
 * for Playwright-driven verification, since CRA/Jest cannot import
 * deck.gl's dependency tree (see layers/nodesLayer.js's docstring).
 *
 * Usage: /dev/viae-map-solutions-preview?executionId=<id>
 *     or /dev/viae-map-solutions-preview?solutionIds=<id>[,<id>...]
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';

import MainCard from 'ui-component/cards/MainCard';
import ViaeMap from 'ui-component/viae-map/ViaeMap';
import { fromVisualizerPayload } from 'ui-component/viae-map/adapters';
import authAxios from 'utils/axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function ViaeMapSolutionsPreview() {
    const [params] = useSearchParams();
    const executionId = params.get('executionId');
    const solutionIds = params.get('solutionIds');

    const [scene, setScene] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!executionId && !solutionIds) return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);
        const req = executionId
            ? authAxios.get(`${API_BASE}/api/v1/solver_executions/visualizer/${executionId}`)
            : authAxios.get(`${API_BASE}/api/v1/visualizer/solutions`, { params: { ids: solutionIds } });
        req.then((res) => {
            if (cancelled) return;
            const result = res?.data?.result;
            if (!result) throw new Error('Empty response');
            setScene(fromVisualizerPayload(result, { endpoint: executionId ? `solver_executions/visualizer/${executionId}` : `visualizer/solutions?ids=${solutionIds}` }));
        })
            .catch((e) => {
                if (!cancelled) setError(e?.message || 'Failed to load');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [executionId, solutionIds]);

    return (
        <MainCard title="ViaeMap solutions preview (dev)" content={false}>
            <Box sx={{ p: 2 }}>
                {!executionId && !solutionIds && (
                    <Typography color="text.secondary">
                        Pass ?executionId=&lt;id&gt; or ?solutionIds=&lt;id&gt; in the URL.
                    </Typography>
                )}
                <ViaeMap scene={scene} height={700} loading={loading} error={error} />
            </Box>
        </MainCard>
    );
}
