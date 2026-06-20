import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    FormControlLabel,
    FormGroup,
    Grid,
    LinearProgress,
    MenuItem,
    Select,
    Slider,
    Stack,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';

import io from 'socket.io-client';

import MainCard from 'ui-component/cards/MainCard';
import SubCard from 'ui-component/cards/SubCard';
import authAxios from 'utils/axios';

const ALL_ALGORITHMS = [
    'Hill Climbing',
    'Simulated Annealing',
    'Genetic Algorithm',
    'Iterated Local Search',
    'VNS/VND',
    'Tabu Search',
    'ALNS'
];

const BASE_URL = 'http://localhost:5000/api/v1/solver/explorer';

function LogLine({ evt, showWorker = true }) {
    const time = evt.ts ? new Date(evt.ts + 'Z').toLocaleTimeString() : '??:??:??';
    const worker = (evt.worker || '').replace('explorer_', 'w');

    const colors = { picking: '#555', started: '#4fc3f7', completed: '#81c784', error: '#ef9a9a' };
    const color = evt.type === 'completed' && evt.status !== 'COMPLETED' ? '#ef9a9a' : colors[evt.type] || '#ccc';

    let text = '';
    if (evt.type === 'picking') text = 'selecting next pair…';
    if (evt.type === 'started')
        text = `→ #${evt.execution_id}  ${evt.algorithm} | ${evt.engine} | ${evt.time_limit}s${evt.use_clustering ? ' +cluster' : ''}${evt.use_secondary ? ' +2phase' : ''} | ${evt.instance_name}`;
    if (evt.type === 'completed')
        text = `${evt.status === 'COMPLETED' ? '✓' : '✗'} #${evt.execution_id}  ${evt.execution_time != null ? evt.execution_time.toFixed(1) + 's' : ''}${evt.best_cost != null ? ' | cost=' + evt.best_cost.toFixed(2) : ''}`;
    if (evt.type === 'error') text = `✗ ${evt.error}`;

    return (
        <Box component="div" sx={{ color, lineHeight: 1.6 }}>
            <span style={{ color: '#666' }}>[{time}] </span>
            {showWorker && <span style={{ color: '#999' }}>{worker} </span>}
            {text}
        </Box>
    );
}

function WorkerLogPanel({ workerName, entries }) {
    const endRef = useRef(null);
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [entries]);

    const label = workerName.replace('explorer_', 'Worker ');

    return (
        <Box
            sx={{
                fontFamily: 'monospace',
                fontSize: 12,
                bgcolor: 'grey.900',
                color: 'grey.100',
                p: 1,
                borderRadius: 1,
                height: 220,
                overflowY: 'auto'
            }}
        >
            <Typography variant="caption" sx={{ color: 'grey.500', display: 'block', mb: 0.5 }}>
                {label}
            </Typography>
            {entries.length === 0 ? (
                <Typography variant="caption" sx={{ color: 'grey.600' }}>
                    idle…
                </Typography>
            ) : (
                entries.map((evt, i) => <LogLine key={i} evt={evt} showWorker={false} />)
            )}
            <div ref={endRef} />
        </Box>
    );
}

function CoverageBar({ label, count, max, color = 'primary', truncate = false }) {
    const pct = max > 0 ? (count / max) * 100 : 0;
    return (
        <Box>
            <Stack direction="row" justifyContent="space-between">
                <Tooltip title={label} disableHoverListener={!truncate}>
                    <Typography
                        variant="caption"
                        sx={
                            truncate
                                ? { maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }
                                : {}
                        }
                    >
                        {label}
                    </Typography>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                    {count}
                </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={pct} color={color} sx={{ height: 6, borderRadius: 3 }} />
        </Box>
    );
}

const ExplorationPage = () => {
    const instance = useSelector((state) => state.instance.instance);

    // Settings
    const [maxWorkers, setMaxWorkers] = useState(4);
    const [engine, setEngine] = useState('auto');
    const [batchTag, setBatchTag] = useState('exploration');
    const [selectedAlgos, setSelectedAlgos] = useState(new Set(ALL_ALGORITHMS));
    const [useInstanceFilter, setUseInstanceFilter] = useState(false);
    const [variants, setVariants] = useState([]);
    const [selectedVariants, setSelectedVariants] = useState(new Set());

    // Status
    const [status, setStatus] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);

    const pollRef = useRef(null);
    const socketRef = useRef(null);
    const [logEntries, setLogEntries] = useState([]);

    const fetchStatus = useCallback(async () => {
        setLoadingStatus(true);
        try {
            const res = await authAxios.get(`${BASE_URL}/status`);
            setStatus(res.data);
            setError(null);
        } catch (e) {
            setError('Failed to fetch explorer status.');
        } finally {
            setLoadingStatus(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        authAxios
            .get(`${BASE_URL}/variants`)
            .then((res) => {
                setVariants(res.data);
                setSelectedVariants(new Set(res.data.map((v) => v.id)));
            })
            .catch(() => {
                /* leave variants empty — Problem Variants filter just won't show */
            });
    }, []);

    useEffect(() => {
        if (status?.running) {
            pollRef.current = setInterval(fetchStatus, 10000);
        } else {
            clearInterval(pollRef.current);
        }
        return () => clearInterval(pollRef.current);
    }, [status?.running, fetchStatus]);

    useEffect(() => {
        if (!status?.running) {
            socketRef.current?.disconnect();
            socketRef.current = null;
            return;
        }
        const sock = io('http://localhost:5000/explorer', {
            transports: ['polling', 'websocket'],
            path: '/socket.io'
        });
        sock.on('connect', () => sock.emit('join_explorer'));
        sock.on('explorer_event', (evt) => {
            setLogEntries((prev) => [...prev.slice(-199), evt]);
        });
        socketRef.current = sock;
        return () => {
            sock.disconnect();
            socketRef.current = null;
        };
    }, [status?.running]);

    const handleStart = async () => {
        setActionLoading(true);
        setError(null);
        try {
            const filters = { algorithms: [...selectedAlgos], engine };
            if (useInstanceFilter && instance) {
                filters.dataset_instance_id = instance.id;
            }
            if (variants.length > 0 && selectedVariants.size < variants.length) {
                filters.variant_ids = [...selectedVariants];
            }
            await authAxios.post(`${BASE_URL}/start`, { max_workers: maxWorkers, batch_tag: batchTag, filters });
            await fetchStatus();
        } catch (e) {
            setError('Failed to start explorer.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleStop = async () => {
        setActionLoading(true);
        setError(null);
        try {
            await authAxios.post(`${BASE_URL}/stop`);
            await fetchStatus();
        } catch (e) {
            setError('Failed to stop explorer.');
        } finally {
            setActionLoading(false);
        }
    };

    const toggleAlgo = (algo) => {
        setSelectedAlgos((prev) => {
            const next = new Set(prev);
            if (next.has(algo)) next.delete(algo);
            else next.add(algo);
            return next;
        });
    };

    const toggleVariant = (variantId) => {
        setSelectedVariants((prev) => {
            const next = new Set(prev);
            if (next.has(variantId)) next.delete(variantId);
            else next.add(variantId);
            return next;
        });
    };

    const isRunning = status?.running;
    const coverage = status?.coverage || {};
    const byAlgo = coverage.by_algorithm || {};
    const byInst = coverage.by_instance || {};
    const byVariant = coverage.by_variant || {};
    const byEngine = coverage.by_engine || {};
    const byClustering = coverage.by_clustering || {};
    const bySecondary = coverage.by_secondary || {};
    const byOperator = coverage.by_operator || {};
    const total = coverage.total_completed || 0;

    const maxAlgoCount = Math.max(...Object.values(byAlgo), 1);
    const maxInstCount = Math.max(...Object.values(byInst), 1);
    const maxVariantCount = Math.max(...Object.values(byVariant), 1);
    const maxEngineCount = Math.max(byEngine.python || 0, byEngine.cpp || 0, 1);
    const clusteringTotal = Math.max((byClustering.clustering || 0) + (byClustering.no_clustering || 0), 1);
    const secondaryTotal = Math.max((bySecondary.with_secondary || 0) + (bySecondary.without_secondary || 0), 1);
    const maxOpCount = Math.max(...Object.values(byOperator), 1);

    const workerCount = isRunning ? status.max_workers || 1 : maxWorkers;
    const logsByWorker = new Map();
    for (let i = 0; i < workerCount; i++) logsByWorker.set(`explorer_${i}`, []);
    for (const evt of logEntries) {
        if (!logsByWorker.has(evt.worker)) logsByWorker.set(evt.worker, []);
        logsByWorker.get(evt.worker).push(evt);
    }

    return (
        <MainCard title="Exploration Engine">
            <Grid container spacing={3}>
                {/* Status banner */}
                <Grid item xs={12}>
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        <Chip
                            label={isRunning ? 'RUNNING' : 'STOPPED'}
                            color={isRunning ? 'success' : 'default'}
                            variant={isRunning ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 700 }}
                        />
                        {isRunning && (
                            <>
                                <Typography variant="body2" color="text.secondary">
                                    {status.max_workers} workers &nbsp;·&nbsp; tag: <strong>{status.batch_tag}</strong>
                                </Typography>
                                <CircularProgress size={16} />
                            </>
                        )}
                        <Typography variant="body2" color="text.secondary">
                            Total completed: <strong>{total.toLocaleString()}</strong>
                        </Typography>
                        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchStatus} disabled={loadingStatus} variant="outlined">
                            Refresh
                        </Button>
                        <Tooltip title="Download ML dataset CSV (all completed executions)">
                            <Button
                                size="small"
                                startIcon={<DownloadIcon />}
                                variant="outlined"
                                color="secondary"
                                component="a"
                                href={`${BASE_URL}/export.csv${batchTag ? `?batch_tag=${encodeURIComponent(batchTag)}` : ''}`}
                                download
                            >
                                Export CSV
                            </Button>
                        </Tooltip>
                    </Stack>
                    {error && (
                        <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>
                            {error}
                        </Typography>
                    )}
                </Grid>

                {/* Row 1: Settings | Algorithm coverage | Instance coverage */}
                <Grid item xs={12} md={5}>
                    <SubCard title="Settings">
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="caption" color="text.secondary" gutterBottom>
                                    Parallel Workers: <strong>{maxWorkers}</strong>
                                </Typography>
                                <Slider
                                    value={maxWorkers}
                                    onChange={(_, v) => setMaxWorkers(v)}
                                    min={1}
                                    max={16}
                                    step={1}
                                    marks={[
                                        { value: 1, label: '1' },
                                        { value: 8, label: '8' },
                                        { value: 16, label: '16' }
                                    ]}
                                    disabled={isRunning}
                                    size="small"
                                />
                            </Box>

                            <Stack direction="row" spacing={2} alignItems="center">
                                <Box flex={1}>
                                    <Typography variant="caption" color="text.secondary">
                                        Engine
                                    </Typography>
                                    <Select
                                        fullWidth
                                        size="small"
                                        value={engine}
                                        onChange={(e) => setEngine(e.target.value)}
                                        disabled={isRunning}
                                    >
                                        <MenuItem value="auto">Auto (coverage-balanced)</MenuItem>
                                        <MenuItem value="python">Python</MenuItem>
                                        <MenuItem value="cpp">C++</MenuItem>
                                        <MenuItem value="any">Any (random)</MenuItem>
                                    </Select>
                                </Box>
                                <Box flex={1}>
                                    <Typography variant="caption" color="text.secondary">
                                        Batch Tag
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        value={batchTag}
                                        onChange={(e) => setBatchTag(e.target.value)}
                                        disabled={isRunning}
                                        placeholder="exploration"
                                    />
                                </Box>
                            </Stack>

                            <Box>
                                <Typography variant="caption" color="text.secondary" gutterBottom>
                                    Algorithms
                                </Typography>
                                <FormGroup row>
                                    {ALL_ALGORITHMS.map((algo) => (
                                        <FormControlLabel
                                            key={algo}
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={selectedAlgos.has(algo)}
                                                    onChange={() => toggleAlgo(algo)}
                                                    disabled={isRunning}
                                                />
                                            }
                                            label={<Typography variant="caption">{algo}</Typography>}
                                            sx={{ mr: 1 }}
                                        />
                                    ))}
                                </FormGroup>
                            </Box>

                            {variants.length > 0 && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary" gutterBottom>
                                        Problem Variants
                                    </Typography>
                                    <FormGroup row>
                                        {variants.map((v) => (
                                            <FormControlLabel
                                                key={v.id}
                                                control={
                                                    <Checkbox
                                                        size="small"
                                                        checked={selectedVariants.has(v.id)}
                                                        onChange={() => toggleVariant(v.id)}
                                                        disabled={isRunning}
                                                    />
                                                }
                                                label={<Typography variant="caption">{v.acronym}</Typography>}
                                                sx={{ mr: 1 }}
                                            />
                                        ))}
                                    </FormGroup>
                                </Box>
                            )}

                            {instance && (
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={useInstanceFilter}
                                            onChange={(e) => setUseInstanceFilter(e.target.checked)}
                                            disabled={isRunning}
                                        />
                                    }
                                    label={
                                        <Typography variant="caption">Restrict to current dataset instance ({instance.name})</Typography>
                                    }
                                />
                            )}

                            <Stack direction="row" spacing={1} pt={1}>
                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
                                    onClick={handleStart}
                                    disabled={isRunning || actionLoading || selectedAlgos.size === 0}
                                    fullWidth
                                >
                                    Start
                                </Button>
                                <Button
                                    variant="contained"
                                    color="error"
                                    startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <StopIcon />}
                                    onClick={handleStop}
                                    disabled={!isRunning || actionLoading}
                                    fullWidth
                                >
                                    Stop
                                </Button>
                            </Stack>
                        </Stack>
                    </SubCard>
                </Grid>

                <Grid item xs={12} md={3.5}>
                    <SubCard title="Coverage by Algorithm">
                        <Stack spacing={1}>
                            {ALL_ALGORITHMS.map((algo) => (
                                <CoverageBar key={algo} label={algo} count={byAlgo[algo] || 0} max={maxAlgoCount} />
                            ))}
                        </Stack>
                    </SubCard>
                </Grid>

                <Grid item xs={12} md={3.5}>
                    <SubCard title="Coverage by Instance">
                        {Object.keys(byInst).length === 0 ? (
                            <Typography variant="caption" color="text.secondary">
                                No completed executions yet.
                            </Typography>
                        ) : (
                            <Stack spacing={1} sx={{ maxHeight: 340, overflowY: 'auto' }}>
                                {Object.entries(byInst)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([name, count]) => (
                                        <CoverageBar key={name} label={name} count={count} max={maxInstCount} color="secondary" truncate />
                                    ))}
                            </Stack>
                        )}
                    </SubCard>
                </Grid>

                {/* Row 2: Engine | Approach | Clustering | Operator Usage */}
                <Grid item xs={12} md={2}>
                    <SubCard title="Engine">
                        <Stack spacing={1}>
                            {['python', 'cpp'].map((eng) => (
                                <CoverageBar
                                    key={eng}
                                    label={eng}
                                    count={byEngine[eng] || 0}
                                    max={maxEngineCount}
                                    color={eng === 'cpp' ? 'warning' : 'primary'}
                                />
                            ))}
                        </Stack>
                    </SubCard>
                </Grid>

                <Grid item xs={12} md={2}>
                    <SubCard title="Approach Type">
                        <Stack spacing={1}>
                            <CoverageBar
                                label="Single Phase"
                                count={bySecondary.without_secondary || 0}
                                max={secondaryTotal}
                                color="primary"
                            />
                            <CoverageBar label="Two Phase" count={bySecondary.with_secondary || 0} max={secondaryTotal} color="success" />
                        </Stack>
                    </SubCard>
                </Grid>

                <Grid item xs={12} md={2}>
                    <SubCard title="Clustering">
                        <Stack spacing={1}>
                            <CoverageBar
                                label="No Clustering"
                                count={byClustering.no_clustering || 0}
                                max={clusteringTotal}
                                color="primary"
                            />
                            <CoverageBar
                                label="With Clustering"
                                count={byClustering.clustering || 0}
                                max={clusteringTotal}
                                color="success"
                            />
                        </Stack>
                    </SubCard>
                </Grid>

                <Grid item xs={12} md={2}>
                    <SubCard title="Coverage by Variant">
                        {Object.keys(byVariant).length === 0 ? (
                            <Typography variant="caption" color="text.secondary">
                                No completed executions yet.
                            </Typography>
                        ) : (
                            <Stack spacing={1} sx={{ maxHeight: 260, overflowY: 'auto' }}>
                                {Object.entries(byVariant)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([acronym, cnt]) => (
                                        <CoverageBar
                                            key={acronym}
                                            label={acronym}
                                            count={cnt}
                                            max={maxVariantCount}
                                            color="secondary"
                                            truncate
                                        />
                                    ))}
                            </Stack>
                        )}
                    </SubCard>
                </Grid>

                <Grid item xs={12} md={4}>
                    <SubCard title="Operator Usage (last 500 runs)">
                        {Object.keys(byOperator).length === 0 ? (
                            <Typography variant="caption" color="text.secondary">
                                No completed executions yet.
                            </Typography>
                        ) : (
                            <Stack spacing={1} sx={{ maxHeight: 260, overflowY: 'auto' }}>
                                {Object.entries(byOperator)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([op, cnt]) => (
                                        <CoverageBar key={op} label={op} count={cnt} max={maxOpCount} color="secondary" />
                                    ))}
                            </Stack>
                        )}
                    </SubCard>
                </Grid>

                {/* Row 3: Worker log, one panel per worker */}
                <Grid item xs={12}>
                    <SubCard
                        title={`Worker Log (${logEntries.length} events, ${workerCount} workers)`}
                        secondary={
                            <Button size="small" onClick={() => setLogEntries([])}>
                                Clear
                            </Button>
                        }
                    >
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 1 }}>
                            {[...logsByWorker.entries()].map(([workerName, entries]) => (
                                <WorkerLogPanel key={workerName} workerName={workerName} entries={entries} />
                            ))}
                        </Box>
                    </SubCard>
                </Grid>
            </Grid>
        </MainCard>
    );
};

export default ExplorationPage;
