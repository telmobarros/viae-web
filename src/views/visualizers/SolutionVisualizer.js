import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import MainCard from 'ui-component/cards/MainCard';
import D3SolutionVisualizer from './D3SolutionVisualizer';
import authAxios from 'utils/axios';

const SolutionVisualizerPage = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const executionId = params.get('executionId');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [payload, setPayload] = useState(null);

    useEffect(() => {
        async function load() {
            if (!executionId) return;
            setLoading(true);
            setError(null);
            try {
                const res = await authAxios.get(`http://localhost:5000/api/v1/solver_executions/visualizer/${executionId}`);
                const data = res?.data?.result;
                setPayload(data);
            } catch (e) {
                setError('Failed to load visualizer payload');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [executionId]);

    const solutionIds = useMemo(() => (payload ? Object.keys(payload.solutions) : []), [payload]);

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
            {loading && (
                <Box display="flex" alignItems="center" gap={1}>
                    <CircularProgress size={20} />
                    <Typography>Loading...</Typography>
                </Box>
            )}
            {error && <Typography color="error">{error}</Typography>}
            {payload && (
                <>
                    <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                        <Typography variant="body2">Execution: #{executionId}</Typography>
                        <Typography variant="body2">Solutions: {solutionIds.join(', ')}</Typography>
                        <Typography variant="body2">
                            Mode: {payload.instance.coordinates === 'lat_lng' ? 'Lat/Lng' : 'Euclidean'}
                        </Typography>
                    </Stack>
                    <D3SolutionVisualizer
                        instance={payload.instance}
                        solutions={payload.solutions}
                        defaultSelected={solutionIds}
                        mode={payload.instance.coordinates === 'lat_lng' ? 'geo' : 'euclidean'}
                        height={560}
                    />
                </>
            )}
        </MainCard>
    );
};

export default SolutionVisualizerPage;
