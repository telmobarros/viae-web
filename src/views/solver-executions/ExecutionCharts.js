import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Grid, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';
import Chart from 'react-apexcharts';

const pickXAxis = (points) => {
    if (!points || !points.length) return null;
    const candidates = ['iteration', 'iter', 'time', 't', 'step', 'seconds'];
    const first = points[0] || {};
    for (const c of candidates) if (c in first) return c;
    // fallback to index
    return '__index__';
};

const buildSeriesFromHistory = (history) => {
    if (!Array.isArray(history)) return null;
    const xKey = pickXAxis(history);
    const keys = Object.keys(history[0] || {});
    const numericKeys = keys.filter((k) => k !== xKey && typeof history[0]?.[k] === 'number');
    if (!numericKeys.length) return null;
    // Build x array
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
    const xVals = iters;

    const makeSeries = (bucket, labelPrefix) => {
        if (!bucket) return [];
        return Object.keys(bucket)
            .filter((k) => Array.isArray(bucket[k]))
            .map((k) => ({ name: `${labelPrefix} ${k}`, data: bucket[k] }));
    };

    const currentSeries = makeSeries(current, 'current');
    const bestSeries = makeSeries(best, 'best');
    return {
        xVals,
        currentSeries,
        bestSeries
    };
};

const chartOptions = (title, xTitle) => ({
    chart: { id: `exec-chart-${title}`, toolbar: { show: false } },
    stroke: { curve: 'smooth', width: 2 },
    legend: { show: true },
    xaxis: { title: { text: xTitle || '' } },
    yaxis: { decimalsInFloat: 2 },
    tooltip: { shared: true },
    title: { text: title, align: 'left' }
});

const ExecutionChartsPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const executionId = searchParams.get('executionId');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [execution, setExecution] = useState(null);

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
        // history-based (array of points)
        if (Array.isArray(m.history) && m.history.length) {
            const built = buildSeriesFromHistory(m.history);
            if (built) {
                const { xKey, xVals, seriesMap } = built;
                // Create multiple charts by grouping related keys if desired; for now, one multi-series chart
                const series = Object.keys(seriesMap).map((name) => ({ name, data: seriesMap[name] }));
                result.push({
                    title: 'Metrics Over Time',
                    options: { ...chartOptions('Metrics Over Time', xKey === '__index__' ? 'index' : xKey), xaxis: { categories: xVals } },
                    series
                });
            }
        } else if (m.history && typeof m.history === 'object') {
            // history-based (dict with iter/current/best)
            const built = buildFromHistoryDict(m.history);
            if (built) {
                const { xVals, currentSeries, bestSeries } = built;
                if (currentSeries.length) {
                    result.push({
                        title: 'Current Metrics by Iteration',
                        options: { ...chartOptions('Current Metrics by Iteration', 'iter'), xaxis: { categories: xVals } },
                        series: currentSeries
                    });
                }
                if (bestSeries.length) {
                    result.push({
                        title: 'Best Metrics by Iteration',
                        options: { ...chartOptions('Best Metrics by Iteration', 'iter'), xaxis: { categories: xVals } },
                        series: bestSeries
                    });
                }
            }
        }
        // series-based (object of arrays)
        if (!result.length && m.series && typeof m.series === 'object') {
            Object.keys(m.series).forEach((key) => {
                const arr = m.series[key];
                if (!Array.isArray(arr) || !arr.length) return;
                if (typeof arr[0] === 'number') {
                    result.push({
                        title: key,
                        options: { ...chartOptions(key, 'index'), xaxis: { categories: arr.map((_, i) => i) } },
                        series: [{ name: key, data: arr }]
                    });
                } else if (typeof arr[0] === 'object') {
                    const xKey = pickXAxis(arr);
                    const xVals = arr.map((p, i) => (xKey === '__index__' ? i : p[xKey]));
                    const yKey = Object.keys(arr[0]).find((k) => k !== xKey && typeof arr[0][k] === 'number') || 'value';
                    const yVals = arr.map((p) => (typeof p[yKey] === 'number' ? p[yKey] : null));
                    result.push({
                        title: key,
                        options: { ...chartOptions(key, xKey === '__index__' ? 'index' : xKey), xaxis: { categories: xVals } },
                        series: [{ name: yKey, data: yVals }]
                    });
                }
            });
        }
        // flat numeric arrays in root metrics (e.g., costHistory)
        if (!result.length) {
            Object.keys(m).forEach((key) => {
                const arr = m[key];
                if (Array.isArray(arr) && arr.length && arr.every((v) => typeof v === 'number')) {
                    result.push({
                        title: key,
                        options: { ...chartOptions(key, 'index'), xaxis: { categories: arr.map((_, i) => i) } },
                        series: [{ name: key, data: arr }]
                    });
                }
            });
        }
        return result;
    }, [execution]);

    return (
        <MainCard
            title={`Execution ${executionId} - Charts`}
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
                    <Grid container spacing={3}>
                        {charts.map((c, idx) => (
                            <Grid item xs={12} md={6} key={idx}>
                                <Chart options={c.options} series={c.series} type="line" height={320} />
                            </Grid>
                        ))}
                    </Grid>
                ))}
        </MainCard>
    );
};

export default ExecutionChartsPage;
