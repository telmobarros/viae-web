import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    Tooltip,
    Typography,
    Grid
} from '@mui/material';
import RefreshTwoToneIcon from '@mui/icons-material/RefreshTwoTone';
import { DataGrid } from '@mui/x-data-grid';

import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';

const formatNumber = (value, digits = 1) => {
    if (value === null || value === undefined) return '—';
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : '—';
};

const LiveSolutionsPage = () => {
    const instance = useSelector((state) => state.instance.instance);
    const [problemInstances, setProblemInstances] = useState([]);
    const [problemInstanceFilter, setProblemInstanceFilter] = useState('');
    const [solutions, setSolutions] = useState([]);
    const [rowCount, setRowCount] = useState(0);
    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
    const [loadingInstances, setLoadingInstances] = useState(false);
    const [loadingSolutions, setLoadingSolutions] = useState(false);
    const [togglingId, setTogglingId] = useState(null);
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

    const fetchSolutions = useCallback(
        async (overrideFilter) => {
            if (!instance) return;
            const filterValue = overrideFilter !== undefined ? overrideFilter : problemInstanceFilter;
            if (filterValue === '') return;
            setLoadingSolutions(true);
            setError(null);
            try {
                const filters = [];
                if (filterValue && filterValue !== 'all') {
                    filters.push({ col: 'problem_instance_id', opr: 'eq', value: filterValue });
                }
                const params = {
                    q: JSON.stringify({
                        filters,
                        order_column: 'id',
                        order_direction: 'desc',
                        page: paginationModel.page,
                        page_size: paginationModel.pageSize
                    })
                };
                const response = await authAxios.get('http://localhost:5000/api/v1/solutions/', { params });
                setSolutions(response?.data?.result || []);
                setRowCount(response?.data?.count || 0);
            } catch {
                setError('Failed to load solutions.');
            } finally {
                setLoadingSolutions(false);
            }
        },
        [instance, problemInstanceFilter, paginationModel]
    );

    useEffect(() => {
        fetchSolutions();
    }, [fetchSolutions]);

    useEffect(() => {
        setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
    }, [problemInstanceFilter]);

    const handleToggleLive = useCallback(async (solutionId, nextValue) => {
        setTogglingId(solutionId);
        setSolutions((prev) => prev.map((s) => (s.id === solutionId ? { ...s, isLive: nextValue } : s)));
        try {
            await authAxios.put(`http://localhost:5000/api/v1/solutions/${solutionId}`, { is_live: nextValue });
        } catch {
            setSolutions((prev) => prev.map((s) => (s.id === solutionId ? { ...s, isLive: !nextValue } : s)));
            setError(`Failed to update live status for solution ${solutionId}.`);
        } finally {
            setTogglingId(null);
        }
    }, []);

    const rows = useMemo(
        () =>
            solutions.map((s) => ({
                id: s.id,
                problemInstanceName: s.problemInstance?.name || '—',
                datasetInstanceName: s.problemInstance?.datasetInstance?.name || '—',
                datasetName: s.problemInstance?.datasetInstance?.dataset?.name || '—',
                nVehicles: s.n_vehicles,
                cost: s.cost,
                quality: s.quality,
                feasibility: s.feasibility,
                isLive: !!s.is_live
            })),
        [solutions]
    );

    const columns = useMemo(
        () => [
            { field: 'id', headerName: 'ID', width: 70 },
            { field: 'datasetName', headerName: 'Dataset', width: 130 },
            { field: 'datasetInstanceName', headerName: 'Dataset Instance', width: 150 },
            { field: 'problemInstanceName', headerName: 'Problem Instance', width: 150 },
            { field: 'nVehicles', headerName: 'Vehicles', width: 90 },
            {
                field: 'cost',
                headerName: 'Cost',
                width: 110,
                valueFormatter: (params) => formatNumber(params.value, 2)
            },
            {
                field: 'quality',
                headerName: 'Quality',
                width: 100,
                valueFormatter: (params) => formatNumber(params.value, 3)
            },
            {
                field: 'feasibility',
                headerName: 'Feasible',
                width: 100,
                renderCell: (params) => (
                    <Chip
                        size="small"
                        label={params.value ? 'Yes' : 'No'}
                        color={params.value ? 'success' : 'default'}
                        variant={params.value ? 'filled' : 'outlined'}
                    />
                )
            },
            {
                field: 'isLive',
                headerName: 'Live',
                width: 110,
                sortable: false,
                filterable: false,
                renderCell: (params) => (
                    <Tooltip title={params.value ? 'Showing on live map' : 'Not tracked on live map'}>
                        <span>
                            <Switch
                                size="small"
                                checked={params.value}
                                disabled={togglingId === params.row.id}
                                onChange={(e) => handleToggleLive(params.row.id, e.target.checked)}
                            />
                        </span>
                    </Tooltip>
                )
            }
        ],
        [togglingId, handleToggleLive]
    );

    if (!instance) {
        return (
            <MainCard title="Live Solutions">
                <Typography color="textSecondary">Select a dataset instance to manage live solutions.</Typography>
            </MainCard>
        );
    }

    return (
        <MainCard title="Live Solutions">
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
                            onClick={() => fetchSolutions()}
                            startIcon={<RefreshTwoToneIcon />}
                            variant="contained"
                            color="secondary"
                            disabled={loadingSolutions || problemInstanceFilter === ''}
                        >
                            Refresh
                        </Button>
                        {loadingSolutions && <CircularProgress size={24} />}
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
                        loading={loadingSolutions}
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

export default LiveSolutionsPage;
