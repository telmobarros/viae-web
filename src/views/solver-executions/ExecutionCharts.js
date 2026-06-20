import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, Grid, IconButton, Paper, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';
import Chart from 'react-apexcharts';

const thinArray = (arr, maxPoints = 3000) => {
    if (!Array.isArray(arr) || arr.length <= maxPoints) return arr;
    const step = arr.length / maxPoints;
    const indices = Array.from({ length: maxPoints }, (_, i) => Math.floor(i * step));
    indices[indices.length - 1] = arr.length - 1;
    return indices.map((i) => arr[i]);
};

const thinHistoryDict = (hist, maxPoints = 3000) => {
    if (!hist || typeof hist !== 'object') return hist;
    const n = Array.isArray(hist.iter) ? hist.iter.length : 0;
    if (n <= maxPoints) return hist;
    const step = n / maxPoints;
    const indices = Array.from({ length: maxPoints }, (_, i) => Math.floor(i * step));
    indices[indices.length - 1] = n - 1;
    const thin = (arr) => (Array.isArray(arr) ? indices.map((i) => arr[i]) : arr);
    const thinBucket = (bucket) =>
        bucket && typeof bucket === 'object' ? Object.fromEntries(Object.entries(bucket).map(([k, v]) => [k, thin(v)])) : bucket;
    return {
        ...hist,
        iter: thin(hist.iter),
        op: thin(hist.op),
        temp: thin(hist.temp),
        current: thinBucket(hist.current),
        best: thinBucket(hist.best)
    };
};

const pickXAxis = (points) => {
    if (!points || !points.length) return null;
    const candidates = ['iteration', 'iter', 'time', 't', 'step', 'seconds'];
    const first = points[0] || {};
    for (const c of candidates) if (c in first) return c;
    return '__index__';
};

const buildSeriesFromHistory = (history) => {
    if (!Array.isArray(history)) return null;
    const xKey = pickXAxis(history);
    const keys = Object.keys(history[0] || {});
    const numericKeys = keys.filter((k) => k !== xKey && typeof history[0]?.[k] === 'number');
    if (!numericKeys.length) return null;
    const xVals = history.map((p, i) => (xKey === '__index__' ? i : p[xKey]));
    const seriesMap = {};
    numericKeys.forEach((k) => {
        seriesMap[k] = history.map((p) => (typeof p[k] === 'number' ? p[k] : null));
    });
    return { xKey, xVals, seriesMap };
};

const buildFromHistoryDict = (hist) => {
    if (!hist || typeof hist !== 'object') return null;
    const iters = Array.isArray(hist.iter) ? hist.iter : null;
    const current = hist.current && typeof hist.current === 'object' ? hist.current : null;
    const best = hist.best && typeof hist.best === 'object' ? hist.best : null;
    if (!iters || (!current && !best)) return null;
    const makeSeries = (bucket, labelPrefix) => {
        if (!bucket) return [];
        return Object.keys(bucket)
            .filter((k) => Array.isArray(bucket[k]))
            .map((k) => ({ name: `${labelPrefix} ${k}`, data: bucket[k] }));
    };
    return { xVals: iters, currentSeries: makeSeries(current, 'current'), bestSeries: makeSeries(best, 'best') };
};

const makeChartOptions = (title, xTitle, fullscreen = false) => ({
    chart: {
        id: `exec-chart-${title}`,
        toolbar: {
            show: true,
            tools: { download: true, selection: false, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true },
            autoSelected: 'zoom'
        },
        zoom: { enabled: true, type: 'x' },
        animations: { enabled: false }
    },
    stroke: { curve: 'straight', width: fullscreen ? 2 : 1.5 },
    legend: { show: true, position: 'bottom' },
    xaxis: { title: { text: xTitle || '' }, tickAmount: 10, labels: { rotate: 0 } },
    yaxis: { decimalsInFloat: 2 },
    tooltip: { shared: true, intersect: false },
    title: { text: title, align: 'left', style: { fontSize: fullscreen ? '16px' : '13px' } },
    grid: { borderColor: '#e0e0e0' },
    markers: { size: 0 }
});

const ChartCard = ({ chart, onFullscreen }) => (
    <Paper variant="outlined" sx={{ p: 1.5, position: 'relative', height: '100%' }}>
        <IconButton size="small" onClick={onFullscreen} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }} title="Fullscreen">
            <FullscreenIcon fontSize="small" />
        </IconButton>
        <Chart options={makeChartOptions(chart.title, chart.xTitle)} series={chart.series} type="line" height={420} />
    </Paper>
);

const ExecutionChartsPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const executionId = searchParams.get('executionId');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [execution, setExecution] = useState(null);
    const [fullscreenIdx, setFullscreenIdx] = useState(null);

    useEffect(() => {
        if (!executionId) return;
        setLoading(true);
        setError(null);
        authAxios
            .get(`http://localhost:5000/api/v1/solver_executions/${executionId}`)
            .then((res) => setExecution(res?.data?.result || null))
            .catch(() => setError('Failed to load execution metrics.'))
            .finally(() => setLoading(false));
    }, [executionId]);

    const charts = useMemo(() => {
        if (!execution?.metrics) return [];
        const m = execution.metrics;
        const result = [];

        if (Array.isArray(m.history) && m.history.length) {
            const built = buildSeriesFromHistory(thinArray(m.history));
            if (built) {
                const { xKey, xVals, seriesMap } = built;
                result.push({
                    title: 'Metrics Over Time',
                    xTitle: xKey === '__index__' ? 'index' : xKey,
                    options: { xaxis: { categories: xVals } },
                    series: Object.keys(seriesMap).map((name) => ({ name, data: seriesMap[name] }))
                });
            }
        } else if (m.history && typeof m.history === 'object') {
            const built = buildFromHistoryDict(thinHistoryDict(m.history));
            if (built) {
                const { xVals, currentSeries, bestSeries } = built;
                if (currentSeries.length) {
                    result.push({
                        title: 'Current Metrics by Iteration',
                        xTitle: 'iter',
                        options: { xaxis: { categories: xVals } },
                        series: currentSeries
                    });
                }
                if (bestSeries.length) {
                    result.push({
                        title: 'Best Metrics by Iteration',
                        xTitle: 'iter',
                        options: { xaxis: { categories: xVals } },
                        series: bestSeries
                    });
                }
            }
        }

        if (!result.length && m.series && typeof m.series === 'object') {
            Object.keys(m.series).forEach((key) => {
                const arr = thinArray(m.series[key]);
                if (!Array.isArray(arr) || !arr.length) return;
                if (typeof arr[0] === 'number') {
                    result.push({
                        title: key,
                        xTitle: 'index',
                        options: { xaxis: { categories: arr.map((_, i) => i) } },
                        series: [{ name: key, data: arr }]
                    });
                } else if (typeof arr[0] === 'object') {
                    const xKey = pickXAxis(arr);
                    const xVals = arr.map((p, i) => (xKey === '__index__' ? i : p[xKey]));
                    const yKey = Object.keys(arr[0]).find((k) => k !== xKey && typeof arr[0][k] === 'number') || 'value';
                    result.push({
                        title: key,
                        xTitle: xKey === '__index__' ? 'index' : xKey,
                        options: { xaxis: { categories: xVals } },
                        series: [{ name: yKey, data: arr.map((p) => (typeof p[yKey] === 'number' ? p[yKey] : null)) }]
                    });
                }
            });
        }

        if (!result.length) {
            Object.keys(m).forEach((key) => {
                const rawArr = m[key];
                if (Array.isArray(rawArr) && rawArr.length && rawArr.every((v) => typeof v === 'number')) {
                    const arr = thinArray(rawArr);
                    result.push({
                        title: key,
                        xTitle: 'index',
                        options: { xaxis: { categories: arr.map((_, i) => i) } },
                        series: [{ name: key, data: arr }]
                    });
                }
            });
        }

        return result;
    }, [execution]);

    const fullscreenChart = fullscreenIdx !== null ? charts[fullscreenIdx] : null;

    return (
        <>
            <MainCard
                title={`Execution ${executionId} — Charts`}
                secondary={
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/solver-executions')}>
                        Back
                    </Button>
                }
            >
                {loading && (
                    <Box display="flex" justifyContent="center" my={4}>
                        <CircularProgress />
                    </Box>
                )}
                {!loading && error && <Typography color="error">{error}</Typography>}
                {!loading &&
                    !error &&
                    (!charts.length ? (
                        <Typography color="textSecondary">No timeseries metrics available for this execution.</Typography>
                    ) : (
                        <Grid container spacing={2}>
                            {charts.map((c, idx) => (
                                <Grid item xs={12} md={6} key={idx}>
                                    <ChartCard chart={c} onFullscreen={() => setFullscreenIdx(idx)} />
                                </Grid>
                            ))}
                        </Grid>
                    ))}
            </MainCard>

            <Dialog
                open={fullscreenChart !== null}
                onClose={() => setFullscreenIdx(null)}
                maxWidth="xl"
                fullWidth
                PaperProps={{ sx: { height: '90vh' } }}
            >
                {fullscreenChart && (
                    <>
                        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0 }}>
                            {fullscreenChart.title}
                            <IconButton onClick={() => setFullscreenIdx(null)}>
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent sx={{ pt: 1 }}>
                            <Chart
                                options={{
                                    ...makeChartOptions(fullscreenChart.title, fullscreenChart.xTitle, true),
                                    ...fullscreenChart.options
                                }}
                                series={fullscreenChart.series}
                                type="line"
                                height="100%"
                            />
                        </DialogContent>
                    </>
                )}
            </Dialog>
        </>
    );
};

export default ExecutionChartsPage;
