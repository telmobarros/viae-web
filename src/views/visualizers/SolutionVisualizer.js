import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Button, Chip, CircularProgress, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import MainCard from 'ui-component/cards/MainCard';
import D3SolutionVisualizer from './D3SolutionVisualizer';
import ViaeMap from 'ui-component/viae-map/ViaeMap';
import { fromVisualizerPayload } from 'ui-component/viae-map/adapters';
import authAxios from 'utils/axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Phase 6 A/B mechanism. Default stays the existing D3 renderer -- the
// solver-executions grid's "Map" button links here with no `engine` param,
// and that link must keep behaving exactly as it does today. Only an
// explicit ?engine=deck opts into the new shared ViaeMap stack.
const ENGINE_D3 = 'd3';
const ENGINE_DECK = 'deck';

const SolutionVisualizerPage = () => {
    const [params, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const executionId = params.get('executionId');
    const engine = params.get('engine') === ENGINE_DECK ? ENGINE_DECK : ENGINE_D3;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [payload, setPayload] = useState(null);
    const [execInfo, setExecInfo] = useState(null);

    // One fetch of the visualizer payload, shared by both engines -- the
    // point of Phase 6's "avoid duplicating backend semantics" instruction.
    // D3SolutionVisualizer consumes the raw snake_case payload (unchanged
    // from before); the deck engine adapts the SAME payload via
    // fromVisualizerPayload. Neither engine fetches anything the other
    // doesn't also see.
    useEffect(() => {
        if (!executionId) return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);
        authAxios
            .get(`${API_BASE}/api/v1/solver_executions/visualizer/${executionId}`)
            .then((res) => {
                if (cancelled) return;
                const data = res?.data?.result;
                if (!data) throw new Error('Empty response');
                setPayload(data);
            })
            .catch((e) => {
                if (!cancelled) setError(e?.response?.data?.error || e?.message || 'Failed to load visualizer payload');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [executionId]);

    // Execution/instance identity for the page chrome (Phase 6 requirement:
    // preserve execution identity + instance/solution context). Reuses the
    // existing solver_executions detail resource -- no new endpoint.
    useEffect(() => {
        if (!executionId) return undefined;
        let cancelled = false;
        authAxios
            .get(`${API_BASE}/api/v1/solver_executions/${executionId}`)
            .then((res) => {
                if (!cancelled) setExecInfo(res?.data?.result || null);
            })
            .catch(() => {
                if (!cancelled) setExecInfo(null); // identity chrome is supplementary; a failure here must not block the map
            });
        return () => {
            cancelled = true;
        };
    }, [executionId]);

    const solutionIds = useMemo(() => (payload ? Object.keys(payload.solutions) : []), [payload]);

    const scene = useMemo(() => {
        if (engine !== ENGINE_DECK || !payload) return null;
        return fromVisualizerPayload(payload, { endpoint: `solver_executions/visualizer/${executionId}` });
    }, [engine, payload, executionId]);

    const setEngine = (nextEngine) => {
        const next = new URLSearchParams(params);
        if (nextEngine === ENGINE_D3)
            next.delete('engine'); // keep the default URL clean, matching "current behaviour" for the default case
        else next.set('engine', nextEngine);
        setSearchParams(next, { replace: false });
    };

    const di = execInfo?.problemInstance?.datasetInstance;

    return (
        <MainCard
            title={<Typography variant="h5">Solution Visualizer</Typography>}
            secondary={
                <Button variant="outlined" size="small" onClick={() => navigate(-1)}>
                    Back
                </Button>
            }
        >
            {!executionId && <Typography color="textSecondary">Missing executionId</Typography>}

            {executionId && (
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                    <Typography variant="body2">Execution #{executionId}</Typography>
                    {di && (
                        <Typography variant="body2" color="text.secondary">
                            {di.dataset?.name ? `${di.dataset.name} · ` : ''}
                            {di.name}
                        </Typography>
                    )}
                    {execInfo?.status && (
                        <Chip
                            size="small"
                            label={execInfo.status}
                            color={execInfo.status === 'COMPLETED' ? 'success' : execInfo.status === 'FAILED' ? 'error' : 'default'}
                        />
                    )}
                    {execInfo?.configuration?.mainMethodology && (
                        <Typography variant="body2" color="text.secondary">
                            {execInfo.configuration.mainMethodology}
                        </Typography>
                    )}
                    <Box sx={{ flexGrow: 1 }} />
                    <ToggleButtonGroup size="small" exclusive value={engine} onChange={(e, v) => v && setEngine(v)}>
                        <ToggleButton value={ENGINE_D3}>Classic (D3)</ToggleButton>
                        <ToggleButton value={ENGINE_DECK}>New (deck.gl)</ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
            )}

            {engine === ENGINE_D3 && (
                <>
                    {loading && (
                        <Box display="flex" alignItems="center" gap={1}>
                            <CircularProgress size={20} />
                            <Typography>Loading...</Typography>
                        </Box>
                    )}
                    {error && <Typography color="error">{error}</Typography>}
                    {payload && (
                        <D3SolutionVisualizer
                            instance={payload.instance}
                            solutions={payload.solutions}
                            defaultSelected={solutionIds}
                            mode={payload.instance.coordinates === 'lat_lng' ? 'geo' : 'euclidean'}
                            height={560}
                        />
                    )}
                </>
            )}

            {engine === ENGINE_DECK && executionId && <ViaeMap scene={scene} loading={loading} error={error} height={700} />}
        </MainCard>
    );
};

export default SolutionVisualizerPage;
