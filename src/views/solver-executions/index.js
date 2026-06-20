import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import RefreshTwoToneIcon from '@mui/icons-material/RefreshTwoTone';
import ReplayIcon from '@mui/icons-material/Replay';
import BarChartIcon from '@mui/icons-material/BarChart';
import MapIcon from '@mui/icons-material/Map';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { DataGrid } from '@mui/x-data-grid';

import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';

const ConfigTooltip = ({ configuration }) => {
    if (!configuration) return null;
    const { mainHyperparameters, mainSearchOperators, engine, ...rest } = configuration;
    const payload = { engine, ...rest, mainHyperparameters, mainSearchOperators };
    const json = JSON.stringify(payload, null, 2);
    return (
        <Tooltip
            title={
                <Box
                    component="pre"
                    sx={{
                        m: 0,
                        p: 0.5,
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                        maxHeight: 320,
                        maxWidth: 420,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}
                >
                    {json}
                </Box>
            }
            arrow
            placement="left"
            componentsProps={{ tooltip: { sx: { maxWidth: 440 } } }}
        >
            <InfoOutlinedIcon fontSize="small" sx={{ cursor: 'pointer', color: 'text.secondary' }} />
        </Tooltip>
    );
};

const statusColorMap = {
    PENDING: 'warning',
    RUNNING: 'info',
    COMPLETED: 'success',
    FAILED: 'error',
    CANCELLED: 'default'
};

const formatDateTime = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString();
    } catch {
        return value;
    }
};

const formatDuration = (value) => {
    if (value === null || value === undefined) return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (n < 60) return `${n.toFixed(1)} s`;
    return `${Math.floor(n / 60)}m ${Math.round(n % 60)}s`;
};

const SolverExecutionsPage = () => {
    const instance = useSelector((state) => state.instance.instance);
    const navigate = useNavigate();
    const [problemInstances, setProblemInstances] = useState([]);
    const [problemInstanceFilter, setProblemInstanceFilter] = useState('');
    const [executions, setExecutions] = useState([]);
    const [rowCount, setRowCount] = useState(0);
    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
    const [loadingInstances, setLoadingInstances] = useState(false);
    const [loadingExecutions, setLoadingExecutions] = useState(false);
    const [rerunningId, setRerunningId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!instance) return;
        setLoadingInstances(true);
        authAxios
            .get(`http://localhost:5000/api/v1/dataset_instances/${instance.id}`)
            .then((res) => {
                const list = res?.data?.result?.problem_instances || [];
                setProblemInstances(list);
                setProblemInstanceFilter((prev) => {
                    if (prev && prev !== 'all' && list.find((pi) => pi.id === prev)) return prev;
                    return list.length ? list[0].id : '';
                });
            })
            .catch(() => {
                setProblemInstances([]);
                setProblemInstanceFilter('');
            })
            .finally(() => setLoadingInstances(false));
    }, [instance]);

    const fetchExecutions = useCallback(
        async (overrideFilter) => {
            if (!instance) return;
            const filterValue = overrideFilter !== undefined ? overrideFilter : problemInstanceFilter;
            if (filterValue === '') return;
            setLoadingExecutions(true);
            setError(null);
            try {
                const filters = [];
                if (filterValue && filterValue !== 'all') {
                    filters.push({ col: 'problem_instance_id', opr: 'eq', value: filterValue });
                }
                const params = {
                    q: JSON.stringify({
                        filters,
                        order_column: 'created_at',
                        order_direction: 'desc',
                        page: paginationModel.page,
                        page_size: paginationModel.pageSize
                    })
                };
                const response = await authAxios.get('http://localhost:5000/api/v1/solver_executions/', { params });
                setExecutions(response?.data?.result || []);
                setRowCount(response?.data?.count || 0);
            } catch {
                setError('Failed to load solver executions.');
            } finally {
                setLoadingExecutions(false);
            }
        },
        [instance, problemInstanceFilter, paginationModel]
    );

    useEffect(() => {
        fetchExecutions();
    }, [fetchExecutions]);

    useEffect(() => {
        setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
    }, [problemInstanceFilter]);

    const handleRerun = useCallback(
        async (executionId) => {
            setRerunningId(executionId);
            try {
                await authAxios.post(`http://localhost:5000/api/v1/solver_executions/${executionId}/rerun`);
                await fetchExecutions();
            } catch {
                setError(`Failed to rerun execution ${executionId}.`);
            } finally {
                setRerunningId(null);
            }
        },
        [fetchExecutions]
    );

    const rows = useMemo(
        () =>
            executions.map((e) => ({
                id: e.id,
                status: e.status,
                methodology: e.configuration?.mainMethodology || '—',
                engine: e.configuration?.engine || 'python',
                configuration: e.configuration || null,
                problemInstanceName: e.problemInstance?.name || '—',
                datasetInstanceName: e.problemInstance?.datasetInstance?.name || '—',
                datasetName: e.problemInstance?.datasetInstance?.dataset?.name || '—',
                executionTime: e.executionTime,
                startTime: e.startTime,
                endTime: e.endTime,
                errorMessage: e.errorMessage || null
            })),
        [executions]
    );

    const columns = useMemo(
        () => [
            { field: 'id', headerName: 'ID', width: 70 },
            {
                field: 'status',
                headerName: 'Status',
                width: 130,
                renderCell: (params) => (
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Chip
                            variant="outlined"
                            size="small"
                            color={statusColorMap[params.value] || 'default'}
                            label={params.value || 'Unknown'}
                        />
                        {params.row.errorMessage && (
                            <Tooltip title={params.row.errorMessage} arrow>
                                <ErrorOutlineIcon fontSize="small" color="error" />
                            </Tooltip>
                        )}
                    </Stack>
                )
            },
            { field: 'methodology', headerName: 'Methodology', width: 140 },
            {
                field: 'engine',
                headerName: 'Engine',
                width: 90,
                renderCell: (params) => (
                    <Chip
                        size="small"
                        label={params.value === 'cpp' ? 'C++' : 'Python'}
                        color={params.value === 'cpp' ? 'primary' : 'default'}
                        variant={params.value === 'cpp' ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                    />
                )
            },
            {
                field: 'configuration',
                headerName: 'Config',
                width: 60,
                sortable: false,
                filterable: false,
                renderCell: (params) => <ConfigTooltip configuration={params.value} />
            },
            { field: 'datasetName', headerName: 'Dataset', width: 110 },
            { field: 'datasetInstanceName', headerName: 'Dataset Instance', width: 130 },
            { field: 'problemInstanceName', headerName: 'Problem Instance', width: 100 },
            {
                field: 'executionTime',
                headerName: 'Duration',
                width: 90,
                valueFormatter: (params) => formatDuration(params.value)
            },
            {
                field: 'startTime',
                headerName: 'Start',
                width: 150,
                valueFormatter: (params) => formatDateTime(params.value)
            },
            {
                field: 'endTime',
                headerName: 'End',
                width: 150,
                valueFormatter: (params) => formatDateTime(params.value)
            },
            {
                field: 'errorMessage',
                headerName: 'Error',
                flex: 1,
                width: 150,
                renderCell: (params) =>
                    params.value ? (
                        <Tooltip title={params.value} arrow>
                            <Typography
                                variant="caption"
                                color="error"
                                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
                            >
                                {params.value}
                            </Typography>
                        </Tooltip>
                    ) : null
            },
            {
                field: 'actions',
                headerName: 'Actions',
                width: 230,
                sortable: false,
                filterable: false,
                renderCell: (params) => (
                    <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Visualize solution">
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<MapIcon fontSize="small" />}
                                onClick={() => navigate(`/visualizer/solution?executionId=${params.row.id}`)}
                            >
                                Map
                            </Button>
                        </Tooltip>
                        <Tooltip title="View convergence charts">
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<BarChartIcon fontSize="small" />}
                                onClick={() => navigate(`/solver-executions/charts?executionId=${params.row.id}`)}
                            >
                                Charts
                            </Button>
                        </Tooltip>
                        <Tooltip title="Rerun with same configuration">
                            <span>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={
                                        rerunningId === params.row.id ? <CircularProgress size={12} /> : <ReplayIcon fontSize="small" />
                                    }
                                    onClick={() => handleRerun(params.row.id)}
                                    disabled={rerunningId === params.row.id}
                                >
                                    Rerun
                                </Button>
                            </span>
                        </Tooltip>
                    </Stack>
                )
            }
        ],
        [navigate, handleRerun, rerunningId]
    );

    if (!instance) {
        return (
            <MainCard title="Solver Executions">
                <Typography color="textSecondary">Select a dataset instance to view solver executions.</Typography>
            </MainCard>
        );
    }

    return (
        <MainCard title="Solver Executions">
            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                            <InputLabel id="problem-instance-filter-label">Problem Instance</InputLabel>
                            <Select
                                labelId="problem-instance-filter-label"
                                label="Problem Instance"
                                value={problemInstanceFilter || ''}
                                onChange={(e) => setProblemInstanceFilter(e.target.value)}
                                disabled={loadingInstances || !problemInstances.length}
                            >
                                {problemInstances.map((pi) => (
                                    <MenuItem value={pi.id} key={pi.id}>
                                        {pi.name || `Instance ${pi.id}`}
                                    </MenuItem>
                                ))}
                                <MenuItem value="all">All problem instances</MenuItem>
                            </Select>
                        </FormControl>
                        <Button
                            onClick={() => fetchExecutions()}
                            startIcon={<RefreshTwoToneIcon />}
                            variant="contained"
                            color="secondary"
                            disabled={loadingExecutions || problemInstanceFilter === ''}
                        >
                            Refresh
                        </Button>
                        {loadingExecutions && <CircularProgress size={24} />}
                    </Stack>
                </Grid>
                <Grid item xs={12}>
                    {error && (
                        <Box mb={2}>
                            <Typography color="error">{error}</Typography>
                        </Box>
                    )}
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        autoHeight
                        density="compact"
                        disableSelectionOnClick
                        loading={loadingExecutions}
                        paginationMode="server"
                        rowCount={rowCount}
                        rowsPerPageOptions={[10, 25, 50]}
                        page={paginationModel.page}
                        pageSize={paginationModel.pageSize}
                        onPageChange={(page) => setPaginationModel((p) => ({ ...p, page }))}
                        onPageSizeChange={(pageSize) => setPaginationModel((p) => ({ ...p, pageSize, page: 0 }))}
                        sx={{ '& .MuiDataGrid-columnHeaders': { backgroundColor: (theme) => theme.palette.background.paper } }}
                    />
                </Grid>
            </Grid>
        </MainCard>
    );
};

export default SolverExecutionsPage;
