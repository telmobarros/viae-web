import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { IconRefresh, IconTrash, IconDownload, IconPlus } from '@tabler/icons-react';
import { DataGrid } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';

import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';

const stateColor = { PENDING: 'default', FETCHING: 'info', READY: 'success', ERROR: 'error' };

const defaultForm = {
    name: '',
    description: '',
    unit: '',
    source_type: 'table_column',
    source_config: { table: '', column: '' },
    routine_minutes: 0
};

const IndicatorFormDialog = ({ open, onClose, onSave, initial, dbSchema }) => {
    const [form, setForm] = useState(initial || defaultForm);

    useEffect(() => {
        setForm(initial || defaultForm);
    }, [initial, open]);

    const handleSourceTypeChange = (e) => {
        const t = e.target.value;
        const emptyConfig = t === 'table_column' ? { table: '', column: '' } : t === 'sql_query' ? { query: '' } : { filename: '' };
        setForm({ ...form, source_type: t, source_config: emptyConfig });
    };

    const tables = dbSchema ? Object.keys(dbSchema.tables || {}) : [];
    const columns = form.source_config?.table && dbSchema ? dbSchema.tables[form.source_config.table] || [] : [];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{initial ? 'Edit Indicator' : 'New Indicator'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Name"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        fullWidth
                        size="small"
                    />
                    <TextField
                        label="Description"
                        value={form.description || ''}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        fullWidth
                        size="small"
                        multiline
                        rows={2}
                    />
                    <TextField
                        label="Unit (e.g. %, count)"
                        value={form.unit || ''}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                        size="small"
                    />
                    <FormControl size="small" fullWidth>
                        <InputLabel>Source Type</InputLabel>
                        <Select value={form.source_type} label="Source Type" onChange={handleSourceTypeChange}>
                            <MenuItem value="table_column">Table / Column</MenuItem>
                            <MenuItem value="sql_query">SQL Query</MenuItem>
                            <MenuItem value="csv">CSV Upload</MenuItem>
                        </Select>
                    </FormControl>

                    {form.source_type === 'table_column' && (
                        <>
                            <FormControl size="small" fullWidth>
                                <InputLabel>Table</InputLabel>
                                <Select
                                    value={form.source_config?.table || ''}
                                    label="Table"
                                    onChange={(e) =>
                                        setForm({ ...form, source_config: { ...form.source_config, table: e.target.value, column: '' } })
                                    }
                                >
                                    {tables.map((t) => (
                                        <MenuItem key={t} value={t}>
                                            {t}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl size="small" fullWidth>
                                <InputLabel>Column (value)</InputLabel>
                                <Select
                                    value={form.source_config?.column || ''}
                                    label="Column (value)"
                                    onChange={(e) => setForm({ ...form, source_config: { ...form.source_config, column: e.target.value } })}
                                >
                                    {columns
                                        .filter((c) => c !== 'id')
                                        .map((c) => (
                                            <MenuItem key={c} value={c}>
                                                {c}
                                            </MenuItem>
                                        ))}
                                </Select>
                            </FormControl>
                        </>
                    )}

                    {form.source_type === 'sql_query' && (
                        <TextField
                            label="SQL Query (must return id, value columns)"
                            value={form.source_config?.query || ''}
                            onChange={(e) => setForm({ ...form, source_config: { query: e.target.value } })}
                            fullWidth
                            multiline
                            rows={4}
                            size="small"
                            helperText="Example: SELECT id, score FROM my_table WHERE active = 1"
                        />
                    )}

                    {form.source_type === 'csv' && (
                        <TextField
                            label="Filename"
                            value={form.source_config?.filename || ''}
                            onChange={(e) => setForm({ ...form, source_config: { filename: e.target.value } })}
                            size="small"
                            helperText="CSV file with columns: id, value"
                        />
                    )}

                    <TextField
                        label="Auto-refresh interval (minutes, 0 = manual)"
                        type="number"
                        value={form.routine_minutes}
                        onChange={(e) => setForm({ ...form, routine_minutes: parseInt(e.target.value) || 0 })}
                        size="small"
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name}>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const IndicatorsPage = () => {
    const instance = useSelector((state) => state.instance.instance);
    const { enqueueSnackbar } = useSnackbar();
    const [indicators, setIndicators] = useState([]);
    const [dbSchema, setDbSchema] = useState(null);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);

    const fetchIndicators = () => {
        if (!instance) return;
        setLoading(true);
        authAxios
            .get(`http://localhost:5000/api/v1/dataset_instances/${instance.id}/risk_indicators`)
            .then((r) => setIndicators(r.data?.result || []))
            .catch(() => enqueueSnackbar('Failed to load indicators', { variant: 'error' }))
            .finally(() => setLoading(false));
    };

    const fetchSchema = () => {
        if (!instance) return;
        authAxios
            .get(`http://localhost:5000/api/v1/dataset_instances/${instance.id}/db_schema`)
            .then((r) => setDbSchema(r.data?.result || {}))
            .catch(() => {});
    };

    useEffect(() => {
        fetchIndicators();
        fetchSchema();
    }, [instance]);

    const handleSave = (form) => {
        if (!instance) return;
        const payload = { ...form, dataset_instance_id: instance.id };
        const req = editTarget
            ? authAxios.put(`http://localhost:5000/api/v1/risk_indicators/${editTarget.id}`, payload)
            : authAxios.post('http://localhost:5000/api/v1/risk_indicators/', payload);
        req.then(() => {
            enqueueSnackbar(editTarget ? 'Indicator updated' : 'Indicator created', { variant: 'success' });
            setDialogOpen(false);
            fetchIndicators();
        }).catch((e) => enqueueSnackbar(e?.response?.data?.error || 'Save failed', { variant: 'error' }));
    };

    const handleFetch = (id) => {
        authAxios
            .post(`http://localhost:5000/api/v1/risk_indicators/${id}/fetch`, { dataset_instance_id: instance?.id })
            .then(() => {
                enqueueSnackbar('Fetch scheduled', { variant: 'info' });
                setTimeout(fetchIndicators, 2000);
            })
            .catch((e) => enqueueSnackbar(e?.response?.data?.error || 'Fetch failed', { variant: 'error' }));
    };

    const handleDelete = (id) => {
        if (!window.confirm('Delete this indicator and all its values?')) return;
        authAxios
            .delete(`http://localhost:5000/api/v1/risk_indicators/${id}?dataset_instance_id=${instance?.id}`)
            .then(() => {
                enqueueSnackbar('Deleted', { variant: 'success' });
                fetchIndicators();
            })
            .catch(() => enqueueSnackbar('Delete failed', { variant: 'error' }));
    };

    const columns = [
        { field: 'name', headerName: 'Name', flex: 1 },
        { field: 'unit', headerName: 'Unit', width: 80 },
        {
            field: 'source_type',
            headerName: 'Source',
            width: 120,
            renderCell: ({ value }) => <Chip label={value} size="small" variant="outlined" />
        },
        {
            field: 'state',
            headerName: 'State',
            width: 100,
            renderCell: ({ value }) => <Chip label={value || 'PENDING'} size="small" color={stateColor[value] || 'default'} />
        },
        {
            field: 'last_fetched_at',
            headerName: 'Last Fetch',
            width: 160,
            renderCell: ({ value }) => (value ? new Date(value).toLocaleString() : '—')
        },
        {
            field: 'actions',
            headerName: '',
            width: 120,
            sortable: false,
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Fetch now">
                        <IconButton size="small" onClick={() => handleFetch(row.id)}>
                            <IconDownload size={16} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                        <IconButton
                            size="small"
                            onClick={() => {
                                setEditTarget(row);
                                setDialogOpen(true);
                            }}
                        >
                            <IconRefresh size={16} />
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
            title="Indicator Catalogue"
            secondary={
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<IconPlus size={16} />}
                    onClick={() => {
                        setEditTarget(null);
                        setDialogOpen(true);
                    }}
                >
                    New Indicator
                </Button>
            }
        >
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <DataGrid rows={indicators} columns={columns} getRowId={(r) => r.id} autoHeight disableRowSelectionOnClick pageSize={20} />
            )}
            <IndicatorFormDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSave={handleSave}
                initial={editTarget}
                dbSchema={dbSchema}
            />
        </MainCard>
    );
};

export default IndicatorsPage;
