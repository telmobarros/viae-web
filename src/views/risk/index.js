import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { Box, Button, Chip, CircularProgress, IconButton, Stack, Tooltip } from '@mui/material';
import { IconPlus, IconTrash, IconCalculator, IconCopy, IconEdit } from '@tabler/icons-react';
import { DataGrid } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';

import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';

const stateColor = { PENDING: 'default', IN_PROGRESS: 'info', READY: 'success', ERROR: 'error' };

const RiskModelsPage = () => {
    const instance = useSelector((state) => state.instance.instance);
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchModels = () => {
        if (!instance) return;
        setLoading(true);
        authAxios
            .get(`http://localhost:5000/api/v1/dataset_instances/${instance.id}/risk_models`)
            .then((r) => setModels(r.data?.result || []))
            .catch(() => enqueueSnackbar('Failed to load risk models', { variant: 'error' }))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchModels();
    }, [instance]);

    const handleCreate = () => {
        if (!instance) return;
        authAxios
            .post('http://localhost:5000/api/v1/risk_models/', {
                name: 'New Risk Model',
                dataset_instance_id: instance.id
            })
            .then((r) => {
                const id = r.data?.result?.id || r.data?.id;
                enqueueSnackbar('Risk model created', { variant: 'success' });
                if (id) navigate(`/risk/${id}`);
                else fetchModels();
            })
            .catch((e) => enqueueSnackbar(e?.response?.data?.error || 'Create failed', { variant: 'error' }));
    };

    const handleCalculate = (id) => {
        authAxios
            .post(`http://localhost:5000/api/v1/risk_models/${id}/calculate`)
            .then(() => {
                enqueueSnackbar('Calculation scheduled', { variant: 'info' });
                setTimeout(fetchModels, 3000);
            })
            .catch((e) => enqueueSnackbar(e?.response?.data?.error || 'Calculate failed', { variant: 'error' }));
    };

    const handleDuplicate = (id) => {
        authAxios
            .post(`http://localhost:5000/api/v1/risk_models/${id}/duplicate`)
            .then(() => {
                enqueueSnackbar('Model duplicated', { variant: 'success' });
                fetchModels();
            })
            .catch((e) => enqueueSnackbar(e?.response?.data?.error || 'Duplicate failed', { variant: 'error' }));
    };

    const handleDelete = (id) => {
        if (!window.confirm('Delete this risk model and all associated data?')) return;
        authAxios
            .delete(`http://localhost:5000/api/v1/risk_models/${id}`)
            .then(() => {
                enqueueSnackbar('Deleted', { variant: 'success' });
                fetchModels();
            })
            .catch(() => enqueueSnackbar('Delete failed', { variant: 'error' }));
    };

    const columns = [
        {
            field: 'name',
            headerName: 'Name',
            flex: 1,
            renderCell: ({ row }) => (
                <Button size="small" onClick={() => navigate(`/risk/${row.id}/view`)}>
                    {row.name}
                </Button>
            )
        },
        {
            field: 'state',
            headerName: 'State',
            width: 110,
            renderCell: ({ value }) => <Chip label={value || 'PENDING'} size="small" color={stateColor[value] || 'default'} />
        },
        { field: 'node_count', headerName: 'Nodes', width: 80 },
        {
            field: 'updated_at',
            headerName: 'Updated',
            width: 160,
            renderCell: ({ value }) => (value ? new Date(value).toLocaleString() : '—')
        },
        {
            field: 'actions',
            headerName: '',
            width: 160,
            sortable: false,
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit / Configure">
                        <IconButton size="small" onClick={() => navigate(`/risk/${row.id}`)}>
                            <IconEdit size={16} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Calculate">
                        <IconButton size="small" onClick={() => handleCalculate(row.id)}>
                            <IconCalculator size={16} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicate">
                        <IconButton size="small" onClick={() => handleDuplicate(row.id)}>
                            <IconCopy size={16} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
                            <IconTrash size={16} />
                        </IconButton>
                    </Tooltip>
                </Stack>
            )
        }
    ];

    return (
        <MainCard
            title="Risk Models"
            secondary={
                <Button variant="contained" size="small" startIcon={<IconPlus size={16} />} onClick={handleCreate}>
                    New Model
                </Button>
            }
        >
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <DataGrid rows={models} columns={columns} getRowId={(r) => r.id} autoHeight disableRowSelectionOnClick pageSize={20} />
            )}
        </MainCard>
    );
};

export default RiskModelsPage;
