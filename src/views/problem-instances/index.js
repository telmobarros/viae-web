import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    FormControlLabel,
    Grid,
    List,
    ListItemButton,
    ListItemText,
    Switch,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { IconPlus } from '@tabler/icons-react';

// project imports
import MainCard from 'ui-component/cards/MainCard';
import SubCard from 'ui-component/cards/SubCard';
import ObjectiveFunctionEditor from 'views/objective-function/ObjectiveFunctionEditor';
import authAxios from 'utils/axios';

const API_ROOT = 'http://localhost:5000/api/v1';

// Every user-editable ProblemInstanceProfile field, grouped for display, with
// a human label and whether the solver actually enforces it today. Mirrors
// app/utils/classification.py's _FLAG_FIELDS plus allow_selective_service --
// keep this list in sync if a field is renamed there.
const FIELD_GROUPS = [
    {
        title: 'Selective service & fleet',
        fields: [
            { field: 'allow_selective_service', label: 'Allow selective service (customer rejection)', enforced: true },
            { field: 'is_multi_depot', label: 'Multiple depots', enforced: false },
            { field: 'is_heterogeneous_fleet', label: 'Heterogeneous fleet', enforced: false },
            { field: 'has_multi_compartment', label: 'Multi-compartment vehicles', enforced: false },
            { field: 'has_capacity_constraints', label: 'Vehicle capacity constraints', enforced: true }
        ]
    },
    {
        title: 'Time & energy',
        fields: [
            { field: 'has_time_windows', label: 'Time windows', enforced: true },
            { field: 'has_energy_autonomy', label: 'Energy / fuel autonomy (G-VRP)', enforced: true }
        ]
    },
    {
        title: 'Route structure & limits',
        fields: [
            { field: 'has_open_routes', label: 'Open routes (may end away from a depot)', enforced: false },
            { field: 'has_route_distance_limits', label: 'Route distance limits', enforced: false },
            { field: 'has_route_duration_limits', label: 'Route duration limits', enforced: false }
        ]
    },
    {
        title: 'Service constraints',
        fields: [
            { field: 'has_pickup_delivery_precedence', label: 'Pickup-delivery precedence', enforced: false },
            { field: 'has_prize_collection', label: 'Prize collection', enforced: false },
            { field: 'has_release_dates', label: 'Release dates', enforced: false },
            { field: 'has_driver_duty_limits', label: 'Driver duty limits', enforced: false },
            { field: 'has_skill_requirements', label: 'Skill requirements', enforced: false },
            { field: 'has_zone_restrictions', label: 'Zone restrictions', enforced: false },
            { field: 'has_incompatibility_constraints', label: 'Incompatibility constraints', enforced: false }
        ]
    },
    {
        title: 'Stochastic & dynamic',
        fields: [
            { field: 'is_stochastic_demand', label: 'Stochastic demand', enforced: false },
            { field: 'is_stochastic_service_time', label: 'Stochastic service time', enforced: false },
            { field: 'is_stochastic_travel', label: 'Stochastic travel', enforced: false },
            { field: 'is_time_dependent', label: 'Time-dependent', enforced: false }
        ]
    }
];

const ALL_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.field));

const ProblemInstancesPage = () => {
    const instance = useSelector((state) => state.instance.instance);
    const { enqueueSnackbar } = useSnackbar();

    const [variants, setVariants] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null); // full ProblemInstance, incl. nested profile
    const [loadingVariant, setLoadingVariant] = useState(false);

    const [editedFlags, setEditedFlags] = useState({});
    const [savingProfile, setSavingProfile] = useState(false);
    const [previewAcronym, setPreviewAcronym] = useState(null);
    const previewTimer = useRef(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchVariants = () => {
        if (!instance) return;
        authAxios
            .get(`${API_ROOT}/dataset_instances/${instance.id}`)
            .then((res) => {
                const list = res.data?.result?.problem_instances || [];
                setVariants(list);
                if (list.length > 0 && !selectedId) {
                    setSelectedId(list[0].id);
                }
            })
            .catch(() => setVariants([]));
    };

    useEffect(fetchVariants, [instance]);

    // Load the full ProblemInstance (with nested profile) for the selection.
    useEffect(() => {
        if (!selectedId) {
            setSelectedVariant(null);
            return;
        }
        setLoadingVariant(true);
        authAxios
            .get(`${API_ROOT}/problem_instances/${selectedId}`)
            .then((res) => {
                const variant = res.data?.result;
                setSelectedVariant(variant);
                const flags = {};
                ALL_FIELDS.forEach((f) => {
                    flags[f] = Boolean(variant?.profile?.[f]);
                });
                setEditedFlags(flags);
                setPreviewAcronym(variant?.profile?.variant_acronym || null);
            })
            .catch(() => {
                setSelectedVariant(null);
            })
            .finally(() => setLoadingVariant(false));
    }, [selectedId]);

    // Live acronym preview: debounced, stateless server-side recompute of
    // what variant_acronym would become for the in-flight (unsaved) flags.
    useEffect(() => {
        if (!selectedVariant?.profile) return;
        if (previewTimer.current) clearTimeout(previewTimer.current);
        previewTimer.current = setTimeout(() => {
            authAxios
                .post(`${API_ROOT}/problem_instance_profiles/preview_acronym`, editedFlags)
                .then((res) => setPreviewAcronym(res.data?.result?.variant_acronym))
                .catch(() => {});
        }, 300);
        return () => {
            if (previewTimer.current) clearTimeout(previewTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editedFlags]);

    const handleToggle = (field) => (event) => {
        setEditedFlags((prev) => ({ ...prev, [field]: event.target.checked }));
    };

    const handleSaveProfile = async () => {
        if (!selectedVariant?.profile?.id) return;
        setSavingProfile(true);
        try {
            const resp = await authAxios.put(`${API_ROOT}/problem_instance_profiles/${selectedVariant.profile.id}`, editedFlags);
            const updatedProfile = resp.data?.result;
            setSelectedVariant((prev) => ({ ...prev, profile: { ...prev.profile, ...updatedProfile } }));
            if (updatedProfile?.variant_acronym) setPreviewAcronym(updatedProfile.variant_acronym);
            enqueueSnackbar('Constraint configuration saved', { variant: 'success' });
        } catch (err) {
            enqueueSnackbar('Error saving constraint configuration', { variant: 'error' });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleCreateVariant = async () => {
        if (!instance) return;
        setCreating(true);
        try {
            const resp = await authAxios.post(`${API_ROOT}/dataset_instances/${instance.id}/problem_instances`, {
                name: newName || 'New Variant',
                description: newDescription
            });
            enqueueSnackbar('Problem variant created', { variant: 'success' });
            setCreateOpen(false);
            setNewName('');
            setNewDescription('');
            const createdId = resp.data?.result?.id;
            fetchVariants();
            if (createdId) setSelectedId(createdId);
        } catch (err) {
            enqueueSnackbar(err?.response?.data?.error || 'Error creating problem variant', { variant: 'error' });
        } finally {
            setCreating(false);
        }
    };

    const hasUnsavedChanges = useMemo(() => {
        if (!selectedVariant?.profile) return false;
        return ALL_FIELDS.some((f) => Boolean(selectedVariant.profile[f]) !== Boolean(editedFlags[f]));
    }, [selectedVariant, editedFlags]);

    return (
        <Box>
            <MainCard
                title="Problem Variants"
                secondary={
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<IconPlus size={16} />}
                        onClick={() => setCreateOpen(true)}
                        disabled={!instance}
                    >
                        New Variant
                    </Button>
                }
            >
                {!instance ? (
                    <Typography variant="body2" color="textSecondary">
                        Select a dataset instance first.
                    </Typography>
                ) : (
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={4}>
                            <SubCard title={`Variants of "${instance.name}"`}>
                                <List disablePadding>
                                    {variants.map((v) => (
                                        <ListItemButton key={v.id} selected={v.id === selectedId} onClick={() => setSelectedId(v.id)}>
                                            <ListItemText
                                                primary={
                                                    <Tooltip title={v.description || ''}>
                                                        <span>{v.name}</span>
                                                    </Tooltip>
                                                }
                                                secondary={v.is_original ? 'Original (derived from data)' : 'Variant'}
                                            />
                                        </ListItemButton>
                                    ))}
                                    {variants.length === 0 && (
                                        <Typography variant="body2" color="textSecondary" sx={{ p: 2 }}>
                                            No problem instances for this dataset yet.
                                        </Typography>
                                    )}
                                </List>
                            </SubCard>
                        </Grid>

                        <Grid item xs={12} md={8}>
                            {loadingVariant && <CircularProgress size={24} />}
                            {!loadingVariant && selectedVariant && (
                                <SubCard
                                    title={selectedVariant.name}
                                    secondary={
                                        previewAcronym && (
                                            <Chip
                                                label={`This variant is currently: ${previewAcronym}`}
                                                color={hasUnsavedChanges ? 'warning' : 'primary'}
                                                variant={hasUnsavedChanges ? 'filled' : 'outlined'}
                                                size="small"
                                            />
                                        )
                                    }
                                >
                                    <Grid container spacing={2}>
                                        {FIELD_GROUPS.map((group) => (
                                            <Grid item xs={12} sm={6} key={group.title}>
                                                <Typography variant="subtitle1" gutterBottom>
                                                    {group.title}
                                                </Typography>
                                                {group.fields.map(({ field, label, enforced }) => (
                                                    <Box key={field} sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <FormControlLabel
                                                            control={
                                                                <Switch
                                                                    size="small"
                                                                    checked={Boolean(editedFlags[field])}
                                                                    onChange={handleToggle(field)}
                                                                />
                                                            }
                                                            label={label}
                                                        />
                                                        {!enforced && (
                                                            <Tooltip title="Stored and editable, but not yet enforced by the solver">
                                                                <Typography variant="caption" color="textSecondary">
                                                                    (not yet enforced)
                                                                </Typography>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                ))}
                                            </Grid>
                                        ))}
                                    </Grid>
                                    <Box sx={{ mt: 2 }}>
                                        <Button
                                            variant="contained"
                                            onClick={handleSaveProfile}
                                            disabled={savingProfile || !hasUnsavedChanges}
                                        >
                                            {savingProfile ? <CircularProgress size={16} /> : 'Save Constraint Configuration'}
                                        </Button>
                                    </Box>
                                </SubCard>
                            )}

                            {!loadingVariant && selectedVariant && (
                                <Box sx={{ mt: 3 }}>
                                    <ObjectiveFunctionEditor problemInstanceId={selectedVariant.id} />
                                </Box>
                            )}
                        </Grid>
                    </Grid>
                )}
            </MainCard>

            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>New Problem Variant</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Starts as an exact copy of the Original's constraint configuration and objective function -- edit only what you want
                        to study.
                    </Typography>
                    <TextField fullWidth label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} sx={{ mb: 2 }} />
                    <TextField
                        fullWidth
                        label="Description"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        multiline
                        rows={2}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateVariant} disabled={creating}>
                        {creating ? <CircularProgress size={16} /> : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ProblemInstancesPage;
