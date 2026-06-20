import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Link,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableFooter,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from '@mui/material';
import ReactApexChart from 'react-apexcharts';
import { useSnackbar } from 'notistack';
import authAxios from 'utils/axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function nodeLabel(id, custom) {
    if (custom) return `${id} (${custom})`;
    return String(id);
}

function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString();
}

function computeWeighting(value, weighting, stats) {
    if (!stats || value == null) return null;
    if (weighting === 'q') {
        const idx = [stats.q1, stats.q2, stats.q3].findIndex((q) => value <= q);
        return idx === -1 ? 'Q4' : `Q${idx + 1}`;
    }
    if (weighting === 'mea' || weighting === 'med') {
        const base = weighting === 'mea' ? stats.mean : stats.q2;
        if (!base) return '∞';
        return parseInt((value / base) * 100) + '%';
    }
    return null;
}

function StatsTooltip({ stats, children }) {
    if (!stats) return children;
    const title = (
        <Box sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
            <div>Mean: {stats.mean != null ? stats.mean.toFixed(3) : '—'}</div>
            <div>Std Dev: {stats.std != null ? stats.std.toFixed(3) : '—'}</div>
            <div>
                Q1: {stats.q1 != null ? stats.q1.toFixed(2) : '—'} | Q2: {stats.q2 != null ? stats.q2.toFixed(2) : '—'} | Q3:{' '}
                {stats.q3 != null ? stats.q3.toFixed(2) : '—'}
            </div>
        </Box>
    );
    return (
        <Tooltip title={title} arrow>
            {children}
        </Tooltip>
    );
}

const ComparisonDialog = ({ open, onClose, collectionId, editComparisonId = null }) => {
    const { enqueueSnackbar } = useSnackbar();
    const isEditMode = editComparisonId != null;
    const [loading, setLoading] = useState(false);
    const [classification, setClassification] = useState(null);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!open) return;
        setDone(false);
        setClassification(null);
        if (isEditMode) {
            fetchById(editComparisonId);
        } else {
            fetchNext(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, collectionId, editComparisonId]);

    const fetchById = async (id) => {
        setLoading(true);
        try {
            const res = await authAxios.get(`${API_BASE}/api/v1/risk_comparisons/${id}/payload`);
            setClassification(res.data);
        } catch {
            enqueueSnackbar('Failed to load comparison', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const fetchNext = async (force = false) => {
        setLoading(true);
        try {
            const url = `${API_BASE}/api/v1/risk_collections/${collectionId}/new_comparison${force ? '?force=true' : ''}`;
            const res = await authAxios.get(url);
            const data = res?.data;
            if (!data?.pair) {
                setDone(true);
            } else {
                setClassification(data);
            }
        } catch {
            enqueueSnackbar('Failed to load next comparison', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handlePick = async (higherRisk) => {
        if (!classification?.id) return;
        setLoading(true);
        try {
            const pair = classification.pair;
            await authAxios.put(`${API_BASE}/api/v1/risk_comparisons/${classification.id}`, {
                higher_risk: higherRisk
            });
            const label =
                higherRisk === false ? nodeLabel(pair.node_id_1, pair.node_custom_1) : nodeLabel(pair.node_id_2, pair.node_custom_2);
            enqueueSnackbar(`${label} marked as higher risk`, { variant: 'success' });
            if (isEditMode) {
                onClose(true);
            } else {
                setClassification(null);
                await fetchNext(false);
            }
        } catch {
            enqueueSnackbar('Failed to save comparison', { variant: 'error' });
            setLoading(false);
        }
    };

    const handleSkip = () => {
        if (isEditMode) {
            onClose(false);
        } else {
            fetchNext(true);
        }
    };

    const features = classification?.features ?? [];
    const pair = classification?.pair;

    const cellValue = (nodeDetails, featureId) => {
        const v = nodeDetails?.[`f${featureId}`];
        return v != null ? Number(v) : null;
    };

    const hasRadarData =
        features.length > 0 &&
        pair &&
        features.some((f) => {
            const v1 = cellValue(pair.node_details_1, f.feature_id);
            const v2 = cellValue(pair.node_details_2, f.feature_id);
            return v1 != null || v2 != null;
        });

    const radarOptions = {
        chart: { toolbar: { show: false } },
        xaxis: { categories: features.map((f) => f.name) },
        colors: ['#ffa781', '#5b0e2d'],
        fill: { opacity: 0.2 },
        markers: { size: 3 },
        legend: { show: true }
    };

    const radarSeries = pair
        ? [
              {
                  name: nodeLabel(pair.node_id_1, pair.node_custom_1),
                  data: features.map((f) => cellValue(pair.node_details_1, f.feature_id) ?? 0)
              },
              {
                  name: nodeLabel(pair.node_id_2, pair.node_custom_2),
                  data: features.map((f) => cellValue(pair.node_details_2, f.feature_id) ?? 0)
              }
          ]
        : [];

    const renderContent = () => {
        if (loading) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                </Box>
            );
        }

        if (done) {
            return (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h5" gutterBottom>
                        All pairs classified!
                    </Typography>
                    <Typography color="text.secondary">
                        Every pair of nodes in this collection has been compared. Run Copeland Counting to update the rankings.
                    </Typography>
                </Box>
            );
        }

        if (!pair) return null;

        const labelA = nodeLabel(pair.node_id_1, pair.node_custom_1);
        const labelB = nodeLabel(pair.node_id_2, pair.node_custom_2);

        return (
            <Box>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: '34%', fontWeight: 600 }}>Feature</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                    {labelA}
                                    <Typography variant="caption" display="block" color="text.secondary">
                                        {formatDate(pair.node_dt_1)}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.72rem' }}>
                                    Ref A
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.72rem' }}>
                                    Ref B
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                                    {labelB}
                                    <Typography variant="caption" display="block" color="text.secondary">
                                        {formatDate(pair.node_dt_2)}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {features.map((f) => {
                                const v1 = cellValue(pair.node_details_1, f.feature_id);
                                const v2 = cellValue(pair.node_details_2, f.feature_id);
                                const sx1 = v1 != null && v2 != null && v1 > v2 ? { backgroundColor: '#FBE9E7' } : {};
                                const sx2 = v1 != null && v2 != null && v2 > v1 ? { backgroundColor: '#FBE9E7' } : {};
                                const w1 = computeWeighting(v1, f.weighting, f.stats);
                                const w2 = computeWeighting(v2, f.weighting, f.stats);
                                return (
                                    <TableRow key={f.feature_id} sx={{ '&:last-child td': { border: 0 } }}>
                                        <TableCell>{f.name}</TableCell>
                                        <TableCell align="right" sx={sx1}>
                                            {v1 != null ? v1.toFixed(2) : '—'}
                                        </TableCell>
                                        <TableCell align="center" sx={{ color: '#AAAAAA', fontSize: '0.75rem' }}>
                                            <StatsTooltip stats={f.stats}>
                                                <span>{w1 ?? ''}</span>
                                            </StatsTooltip>
                                        </TableCell>
                                        <TableCell align="center" sx={{ color: '#AAAAAA', fontSize: '0.75rem' }}>
                                            <StatsTooltip stats={f.stats}>
                                                <span>{w2 ?? ''}</span>
                                            </StatsTooltip>
                                        </TableCell>
                                        <TableCell sx={sx2}>{v2 != null ? v2.toFixed(2) : '—'}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <Typography variant="body2" color="text.secondary">
                                            Which node is riskier?
                                        </Typography>
                                        <Link component="button" onClick={handleSkip} underline="hover" sx={{ fontSize: '0.8rem' }}>
                                            {isEditMode ? 'Cancel' : 'Skip'}
                                        </Link>
                                    </Stack>
                                </TableCell>
                                <TableCell align="right" colSpan={2}>
                                    <Button
                                        variant={isEditMode && classification?.higher_risk === false ? 'contained' : 'outlined'}
                                        size="small"
                                        fullWidth
                                        onClick={() => handlePick(false)}
                                        disabled={loading}
                                    >
                                        A — {labelA}
                                    </Button>
                                </TableCell>
                                <TableCell colSpan={2}>
                                    <Button
                                        variant={
                                            isEditMode && classification?.higher_risk === true
                                                ? 'contained'
                                                : isEditMode
                                                  ? 'outlined'
                                                  : 'contained'
                                        }
                                        size="small"
                                        fullWidth
                                        onClick={() => handlePick(true)}
                                        disabled={loading}
                                    >
                                        B — {labelB}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </TableContainer>

                {hasRadarData && (
                    <Box sx={{ px: 2, pb: 1 }}>
                        <ReactApexChart type="radar" series={radarSeries} options={radarOptions} height={300} />
                    </Box>
                )}
            </Box>
        );
    };

    const pair_ = classification?.pair;
    const subtitleLabel = pair_
        ? `${nodeLabel(pair_.node_id_1, pair_.node_custom_1)} vs ${nodeLabel(pair_.node_id_2, pair_.node_custom_2)}`
        : null;

    return (
        <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="md">
            <DialogTitle>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h4">{isEditMode ? 'Edit Pairwise Comparison' : 'New Pairwise Comparison'}</Typography>
                    {!done && subtitleLabel && (
                        <Typography variant="caption" color="text.secondary">
                            {subtitleLabel}
                        </Typography>
                    )}
                </Stack>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ p: 0 }}>{renderContent()}</DialogContent>
            <Divider />
            <DialogActions>
                <Button onClick={() => onClose(done)} color={done ? 'primary' : 'inherit'} variant={done ? 'contained' : 'text'}>
                    {isEditMode ? 'Cancel' : done ? 'Close' : 'Done for now'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ComparisonDialog;
