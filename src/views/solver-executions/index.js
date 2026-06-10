import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import { Box, Button, Chip, CircularProgress, FormControl, Grid, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import RefreshTwoToneIcon from '@mui/icons-material/RefreshTwoTone';
import { DataGrid } from '@mui/x-data-grid';

import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';

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
        const date = new Date(value);
        return date.toLocaleString();
    } catch (err) {
        return value;
    }
};

const formatDuration = (value) => {
    if (value === null || value === undefined) return '—';
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '—';
    if (numericValue < 60) return `${numericValue.toFixed(1)} s`;
    const minutes = Math.floor(numericValue / 60);
    const seconds = Math.round(numericValue % 60);
    return `${minutes}m ${seconds}s`;
};

const SolverExecutionsPage = () => {
    const instance = useSelector((state) => state.instance.instance);
    const navigate = useNavigate();
    const [problemInstances, setProblemInstances] = useState([]);
    const [problemInstanceFilter, setProblemInstanceFilter] = useState('');
    const [executions, setExecutions] = useState([]);
    const [loadingInstances, setLoadingInstances] = useState(false);
    const [loadingExecutions, setLoadingExecutions] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!instance) return;
        setLoadingInstances(true);
        authAxios
            .get(`http://localhost:5000/api/v1/dataset_instances/${instance.id}`)
            .then((apiResponse) => {
                const list = apiResponse?.data?.result?.problem_instances || [];
                setProblemInstances(list);
                if (!list.length) {
                    setProblemInstanceFilter('');
                    return;
                }
                setProblemInstanceFilter((prev) => {
                    if (prev && prev !== 'all' && list.find((pi) => pi.id === prev)) {
                        return prev;
                    }
                    return list[0].id;
                });
            })
            .catch(() => {
                setProblemInstances([]);
                setProblemInstanceFilter('');
            })
            .finally(() => {
                setLoadingInstances(false);
            });
    }, [instance]);

    const fetchExecutions = useCallback(
        async (overrideFilter) => {
            if (!instance) return;
            const filterValue = overrideFilter !== undefined ? overrideFilter : problemInstanceFilter;
            if (filterValue === '') return;
            setLoadingExecutions(true);
            setError(null);
            try {
                const params = { q: {} };
                if (filterValue && filterValue !== 'all') {
                    params.q.filters = [
                        {
                            col: 'problem_instance',
                            opr: 'rel_o_m',
                            value: filterValue
                        }
                    ];
                }
                const response = await authAxios.get('http://localhost:5000/api/v1/solver_executions/', { params });
                setExecutions(response?.data?.result || []);
            } catch (err) {
                setError('Failed to load solver executions.');
            } finally {
                setLoadingExecutions(false);
            }
        },
        [instance, problemInstanceFilter]
    );

    useEffect(() => {
        fetchExecutions();
    }, [fetchExecutions]);

    const rows = useMemo(
        () =>
            executions.map((execution) => ({
                id: execution.id,
                status: execution.status,
                methodology: execution.configuration?.mainMethodology || '—',
                problemInstanceName: execution.problemInstance?.name || '—',
                datasetInstanceName: execution.problemInstance?.datasetInstance?.name || '—',
                startTime: execution.startTime,
                endTime: execution.endTime,
                executionTime: execution.executionTime,
                errorMessage: execution.errorMessage,
                createdAt: execution.createdAt
            })),
        [executions]
    );

    const columns = useMemo(
        () => [
            { field: 'id', headerName: 'Execution ID', width: 130 },
            {
                field: 'status',
                headerName: 'Status',
                width: 150,
                renderCell: (params) => {
                    const color = statusColorMap[params.value] || 'default';
                    return <Chip variant="outlined" size="small" color={color} label={params.value || 'Unknown'} />;
                }
            },
            { field: 'methodology', headerName: 'Methodology', flex: 1, minWidth: 180 },
            { field: 'problemInstanceName', headerName: 'Problem Instance', flex: 1, minWidth: 180 },
            { field: 'datasetInstanceName', headerName: 'Dataset Instance', flex: 1, minWidth: 180 },
            {
                field: 'startTime',
                headerName: 'Start Time',
                width: 190,
                valueFormatter: (params) => formatDateTime(params.value)
            },
            {
                field: 'endTime',
                headerName: 'End Time',
                width: 190,
                valueFormatter: (params) => formatDateTime(params.value)
            },
            {
                field: 'executionTime',
                headerName: 'Duration',
                width: 140,
                valueFormatter: (params) => formatDuration(params.value)
            },
            {
                field: 'errorMessage',
                headerName: 'Error',
                flex: 1,
                minWidth: 220,
                renderCell: (params) => (
                    <Typography variant="body2" color={params.value ? 'error' : 'text.secondary'} noWrap>
                        {params.value || '—'}
                    </Typography>
                )
            },
            {
                field: 'actions',
                headerName: 'Actions',
                width: 260,
                sortable: false,
                filterable: false,
                renderCell: (params) => (
                    <Stack direction="row" spacing={1}>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => navigate(`/visualizer/solution?executionId=${params.row.id}`)}
                        >
                            Visualize
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => navigate(`/solver-executions/charts?executionId=${params.row.id}`)}
                        >
                            Charts
                        </Button>
                    </Stack>
                )
            }
        ],
        [navigate]
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
                                onChange={(e) => {
                                    setProblemInstanceFilter(e.target.value);
                                }}
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
                        disableRowSelectionOnClick
                        loading={loadingExecutions}
                        pageSizeOptions={[10, 25, 50]}
                        initialState={{
                            pagination: {
                                paginationModel: { pageSize: 10, page: 0 }
                            }
                        }}
                        sx={{
                            '& .MuiDataGrid-columnHeaders': {
                                backgroundColor: (theme) => theme.palette.background.paper
                            }
                        }}
                    />
                </Grid>
            </Grid>
        </MainCard>
    );
};

export default SolverExecutionsPage;
