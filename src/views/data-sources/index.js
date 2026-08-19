/**
 * DS8 -- DataSource integration workflow for the selected DatasetInstance.
 *
 * Implements the workflow certified by DS1-DS7, reflecting rather than
 * obscuring that architecture:
 *
 *   DataSource            = connection
 *   DataSourceModel       = canonical entity + external object + external identity
 *   DataSourceFieldMapping= canonical scalar field <- external column
 *   reconcile             = safely create supported missing canonical identities
 *   materialise           = copy externally-owned fields into existing local rows
 *   sync                  = reconcile, then materialise
 *
 * Everything VIAE-canonical shown here (entity list, field list, which fields
 * may be mapped, what a new row needs) comes from the backend contract
 * endpoint /canonical_contract/*. There is deliberately no hand-written copy
 * of Node's fields in this file -- that list would drift from the ORM.
 *
 * Conventions reused from the existing frontend rather than reinvented:
 * MainCard + MUI + @mui/x-data-grid, `authAxios` (utils/axios) for
 * authenticated calls, notistack for feedback, and the Redux-selected active
 * instance (state.instance.instance), matching views/risk/indicators/.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    Grid,
    InputLabel,
    LinearProgress,
    Link,
    MenuItem,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { IconEye, IconPlugConnected, IconRefresh, IconTrash } from '@tabler/icons-react';
import { useSnackbar } from 'notistack';

import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';

const API = 'http://localhost:5000/api/v1';
// Fast enough to feel live, slow enough that a multi-hour ASAE run does not
// generate a request storm of its own.
const POLL_INTERVAL_MS = 1500;

// Structural validation states from DS4's MappingValidationStatus, translated
// for humans. Deliberately NOT collapsed to valid/invalid: staged, incomplete
// configuration is a legitimate intermediate state, not an error (§9).
const VALIDATION_PRESENTATION = {
    READY: { severity: 'success', label: 'Ready', hint: 'This mapping can be synchronised.' },
    INCOMPLETE: {
        severity: 'info',
        label: 'Incomplete',
        hint: 'Still being configured — choose the object and identity column to finish.'
    },
    CONNECTION_ERROR: { severity: 'error', label: 'Connection failed', hint: 'The data source could not be reached.' },
    SCHEMA_NOT_FOUND: { severity: 'error', label: 'Schema not found', hint: 'The selected schema no longer exists.' },
    OBJECT_NOT_FOUND: { severity: 'error', label: 'Table/view not found', hint: 'The selected table or view no longer exists.' },
    ID_COLUMN_NOT_FOUND: { severity: 'error', label: 'Identity column not found', hint: 'The external ID column no longer exists.' },
    UNSUPPORTED_CANONICAL_ENTITY: { severity: 'error', label: 'Unsupported entity', hint: 'This entity cannot be mapped.' },
    PROVIDER_NOT_READY: { severity: 'warning', label: 'Provider not ready', hint: 'Fix the mapping above first.' },
    CANONICAL_FIELD_IS_IDENTITY: {
        severity: 'error',
        label: 'Identity is not an ordinary field',
        hint: 'Use the external ID column instead.'
    },
    UNSUPPORTED_CANONICAL_FIELD: { severity: 'error', label: 'Field cannot be mapped', hint: 'This field is not externally mappable.' },
    EXTERNAL_COLUMN_NOT_FOUND: { severity: 'error', label: 'External column missing', hint: 'The mapped column no longer exists.' },
    TYPE_INCOMPATIBLE: { severity: 'error', label: 'Type incompatible', hint: 'The external column type does not fit this field.' }
};

const presentValidation = (status) => VALIDATION_PRESENTATION[status] || { severity: 'warning', label: status || 'Unknown', hint: '' };

// Ownership verdicts from app/utils/canonical_contract.py.
const OWNERSHIP_LABEL = {
    external: { label: 'External', color: 'primary' },
    local: { label: 'Local', color: 'default' },
    local_special: { label: 'Local / coupled', color: 'secondary' },
    identity: { label: 'Identity', color: 'info' },
    derived: { label: 'Derived', color: 'info' },
    not_mappable: { label: 'Not mappable', color: 'default' }
};

const errorText = (err, fallback) => err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;

// ---------------------------------------------------------------------------

const ValidationBanner = ({ result }) => {
    if (!result) return null;
    const presentation = presentValidation(result.status);
    return (
        <Alert severity={presentation.severity} sx={{ mt: 2 }}>
            <strong>{presentation.label}.</strong> {presentation.hint}
            {result.message ? (
                <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                    {result.message}
                </Typography>
            ) : null}
        </Alert>
    );
};

/**
 * Live progress for a running synchronisation.
 *
 * Determinate whenever the server knows a total, indeterminate otherwise —
 * `percent` is deliberately null rather than guessed server-side, and a bar
 * that invents a position is worse than one that admits it does not know.
 */
const SyncProgressPanel = ({ progress }) => {
    if (!progress) return null;

    // Marked RUNNING with nothing actually running — an interrupted run that
    // had no chance to record how it ended. Say so plainly: the previous
    // design showed this as a live sync forever, with the Synchronise button
    // disabled and no way for the user to discover why.
    if (progress.stale) {
        return (
            <Alert severity="warning" sx={{ mt: 2 }}>
                This mapping is marked as <strong>running</strong>, but no synchronisation is actually in progress — the last one was
                interrupted before it could record how it ended
                {progress.last_sync_attempt_at ? ` (started ${new Date(progress.last_sync_attempt_at).toLocaleString()})` : ''}. Nothing is
                stuck; starting a new synchronisation replaces this state.
            </Alert>
        );
    }

    if (!progress.queued) return null;

    const { percent, processed, total, phase_label: phaseLabel, queued } = progress;
    const determinate = percent !== null && percent !== undefined;

    return (
        <Box sx={{ mt: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
                <Typography variant="body2">{queued && !phaseLabel ? 'Waiting to start…' : phaseLabel || 'Synchronising…'}</Typography>
                <Typography variant="caption" color="textSecondary">
                    {total
                        ? `${(processed || 0).toLocaleString()} / ${total.toLocaleString()}${determinate ? ` · ${percent}%` : ''}`
                        : processed
                          ? `${processed.toLocaleString()} rows`
                          : ''}
                </Typography>
            </Stack>
            <LinearProgress variant={determinate ? 'determinate' : 'indeterminate'} value={determinate ? percent : undefined} />
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                This runs in the background — you can leave this page and come back.
            </Typography>
        </Box>
    );
};

const SyncResultPanel = ({ result }) => {
    if (!result) return null;
    const reconciliation = result.reconciliation || {};
    const materialisation = result.materialisation || {};
    const blocked = reconciliation.blocked_ids || [];
    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
                Synchronisation result
            </Typography>
            <Grid container spacing={1}>
                {[
                    ['External rows', reconciliation.external_count],
                    ['Matched', reconciliation.matched_count],
                    ['Created', reconciliation.created_count],
                    ['Blocked', reconciliation.blocked_count],
                    ['Local-only for this provider', reconciliation.local_only_count],
                    ['Fields updated', materialisation.updated_count]
                ].map(([label, value]) => (
                    <Grid item xs={6} sm={4} md={2} key={label}>
                        <MainCard content={false} sx={{ p: 1.5 }}>
                            <Typography variant="h4">{value ?? '—'}</Typography>
                            <Typography variant="caption" color="textSecondary">
                                {label}
                            </Typography>
                        </MainCard>
                    </Grid>
                ))}
            </Grid>

            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                {reconciliation.status ? (
                    <Chip
                        size="small"
                        label={`Reconcile: ${reconciliation.status}`}
                        color={reconciliation.status === 'COMPLETED' ? 'success' : 'error'}
                    />
                ) : null}
                {materialisation.status ? (
                    <Chip
                        size="small"
                        label={`Materialise: ${materialisation.status}`}
                        color={materialisation.status === 'FAILED' ? 'error' : 'success'}
                    />
                ) : (
                    <Chip size="small" label="Materialise: not attempted" />
                )}
            </Stack>

            {/* A failed phase carries the reason; showing only the counts made
                a refused sync look like an empty one. */}
            {reconciliation.status && reconciliation.status !== 'COMPLETED' ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                    <strong>Reconciliation failed.</strong> {reconciliation.error || reconciliation.message}
                    {result.materialisation == null ? (
                        <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                            Field materialisation was not attempted, so nothing was written.
                        </Typography>
                    ) : null}
                </Alert>
            ) : null}
            {materialisation.status === 'FAILED' ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                    <strong>Materialisation failed.</strong> {materialisation.error || materialisation.message}
                </Alert>
            ) : null}

            {blocked.length > 0 ? (
                <Alert severity="warning" sx={{ mt: 2 }}>
                    <strong>{blocked.length} external identity/identities were not created.</strong> Nothing was invented for them.
                    <ul style={{ margin: '4px 0 0 16px' }}>
                        {blocked.map((entry) => (
                            <li key={entry.id}>
                                <code>{entry.id}</code> — {entry.reason}
                            </li>
                        ))}
                    </ul>
                </Alert>
            ) : null}

            {reconciliation.local_only_count > 0 ? (
                // DS7 terminology: never "orphan", never "deleted externally".
                // Several providers may legitimately cover different subsets.
                <Alert severity="info" sx={{ mt: 2 }}>
                    {reconciliation.local_only_count} local record(s) were not returned by this provider. They were left untouched — another
                    provider may legitimately supply them.
                </Alert>
            ) : null}
        </Box>
    );
};

const PreviewDialog = ({ open, onClose, preview, loading }) => (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>Preview — nothing is written</DialogTitle>
        <DialogContent dividers>
            {loading ? (
                <Stack alignItems="center" sx={{ py: 4 }}>
                    <CircularProgress />
                </Stack>
            ) : !preview ? null : !preview.ok ? (
                <Alert severity="error">{preview.error || preview.message}</Alert>
            ) : (
                <>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                        {preview.message}
                    </Typography>
                    {(preview.identity_warnings || []).map((warning) => (
                        <Alert severity="warning" sx={{ mb: 1 }} key={warning}>
                            {warning}
                        </Alert>
                    ))}
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Canonical ID</TableCell>
                                    <TableCell>Status</TableCell>
                                    {(preview.columns || []).map((column) => (
                                        <TableCell key={column.canonical_field}>
                                            {column.canonical_field}
                                            <Typography variant="caption" component="div" color="textSecondary">
                                                ← {column.external_column}
                                            </Typography>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(preview.rows || []).map((row, index) => (
                                    <TableRow key={`${row.canonical_id}-${index}`}>
                                        <TableCell>{String(row.canonical_id ?? '—')}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={row.match_status}
                                                color={row.match_status === 'MATCHED' ? 'success' : 'default'}
                                            />
                                        </TableCell>
                                        {(preview.columns || []).map((column) => (
                                            <TableCell key={column.canonical_field}>
                                                {String(row.values?.[column.canonical_field] ?? '—')}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </>
            )}
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Close</Button>
        </DialogActions>
    </Dialog>
);

// ---------------------------------------------------------------------------

const FieldMappingEditor = ({ mapping, contract, columns, fieldMappings, onChanged }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [pendingField, setPendingField] = useState('');
    const [pendingColumn, setPendingColumn] = useState('');

    const mappedByField = useMemo(() => Object.fromEntries((fieldMappings || []).map((fm) => [fm.canonical_field, fm])), [fieldMappings]);

    // Selectable = anything the backend contract marks `mappable`: ordinary
    // DIRECT fields plus members of a coupled group (Node's latitude and
    // longitude). Derived outputs such as gps_location are deliberately not
    // selectable — VIAE computes them from the group. Everything else is
    // still *shown* read-only with the backend's own reason rather than
    // hidden, and the classification comes from the contract endpoint rather
    // than any field list held here.
    const mappableFields = (contract?.fields || []).filter((field) => field.mappable);

    // Coupled groups that are only half mapped. Derived from the contract's
    // own group metadata, so this stays correct if another group is added.
    const incompleteGroups = useMemo(() => {
        const groups = {};
        (contract?.fields || []).forEach((field) => {
            if (!field.group) return;
            groups[field.group] = groups[field.group] || { fields: field.group_fields || [], mapped: [] };
            if (mappedByField[field.name]) groups[field.group].mapped.push(field.name);
        });
        return Object.entries(groups)
            .filter(([, g]) => g.mapped.length > 0 && g.mapped.length < g.fields.length)
            .map(([name, g]) => ({
                name,
                missing: g.fields.filter((f) => !g.mapped.includes(f))
            }));
    }, [contract, mappedByField]);

    const addMapping = async () => {
        try {
            await authAxios.post(`${API}/data_source_field_mappings/`, {
                data_source_model_id: mapping.id,
                canonical_field: pendingField,
                external_column: pendingColumn
            });
            setPendingField('');
            setPendingColumn('');
            enqueueSnackbar('Field mapping added', { variant: 'success' });
            onChanged();
        } catch (err) {
            enqueueSnackbar(errorText(err, 'Could not add the field mapping'), { variant: 'error' });
        }
    };

    const removeMapping = async (id) => {
        try {
            await authAxios.delete(`${API}/data_source_field_mappings/${id}`);
            enqueueSnackbar('Field mapping removed', { variant: 'success' });
            onChanged();
        } catch (err) {
            enqueueSnackbar(errorText(err, 'Could not remove the field mapping'), { variant: 'error' });
        }
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
                Field mappings
            </Typography>

            {/* Coupled fields must be mapped together; the rule and the group
                membership both come from the backend contract. */}
            {incompleteGroups.map((group) => (
                <Alert severity="warning" sx={{ mb: 1 }} key={group.name}>
                    {group.name === 'geography'
                        ? 'Latitude and longitude must be mapped together.'
                        : `The ${group.name} fields must be mapped together.`}{' '}
                    Still missing: <strong>{group.missing.join(', ')}</strong>. This mapping cannot be synchronised until the group is
                    complete.
                </Alert>
            ))}

            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>VIAE field</TableCell>
                            <TableCell>External column</TableCell>
                            <TableCell>Ownership</TableCell>
                            <TableCell align="right" />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(contract?.fields || [])
                            .filter((field) => field.default_ownership !== 'identity')
                            .map((field) => {
                                const existing = mappedByField[field.name];
                                const ownership = existing ? 'external' : field.default_ownership;
                                const presentation = OWNERSHIP_LABEL[ownership] || OWNERSHIP_LABEL.local;
                                return (
                                    <TableRow key={field.name}>
                                        <TableCell>
                                            {field.name}
                                            <Typography variant="caption" component="div" color="textSecondary">
                                                {field.type}
                                                {field.required_for_creation ? ' · required to create' : ''}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            {/* A derived field has no source column of its own —
                                                say so rather than showing an empty cell that looks
                                                like an unmapped, mappable field. */}
                                            {field.mapping_kind === 'derived' ? (
                                                <Typography variant="body2" color="textSecondary">
                                                    Derived automatically
                                                </Typography>
                                            ) : (
                                                existing?.external_column || '—'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title={field.reason || ''}>
                                                <Chip size="small" label={presentation.label} color={presentation.color} />
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell align="right">
                                            {existing ? (
                                                <Button
                                                    size="small"
                                                    color="error"
                                                    startIcon={<IconTrash size={16} />}
                                                    onClick={() => removeMapping(existing.id)}
                                                >
                                                    Remove
                                                </Button>
                                            ) : null}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                    </TableBody>
                </Table>
            </TableContainer>

            <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>VIAE field</InputLabel>
                    <Select value={pendingField} label="VIAE field" onChange={(e) => setPendingField(e.target.value)}>
                        {mappableFields
                            .filter((field) => !mappedByField[field.name])
                            .map((field) => (
                                <MenuItem key={field.name} value={field.name}>
                                    {field.name}
                                </MenuItem>
                            ))}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>External column</InputLabel>
                    <Select value={pendingColumn} label="External column" onChange={(e) => setPendingColumn(e.target.value)}>
                        {(columns || []).map((column) => (
                            <MenuItem key={column.name} value={column.name}>
                                {column.name} <Typography variant="caption">&nbsp;({column.type})</Typography>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Button variant="outlined" disabled={!pendingField || !pendingColumn} onClick={addMapping}>
                    Add mapping
                </Button>
            </Stack>
        </Box>
    );
};

// ---------------------------------------------------------------------------

const MappingPanel = ({ mapping, dataSources, contracts, onChanged }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [columns, setColumns] = useState([]);
    const [fieldMappings, setFieldMappings] = useState([]);
    const [validation, setValidation] = useState(null);
    const [syncResult, setSyncResult] = useState(null);
    const [preview, setPreview] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [progress, setProgress] = useState(null);
    // Held in a ref so unmounting stops the poll: a component that has gone
    // away must not keep hitting the API, and setState on it would warn.
    const pollTimer = useRef(null);

    const contract = contracts?.[mapping.data_source_model];
    const provider = (dataSources || []).find((ds) => ds.id === mapping.data_source_id);

    const loadDetails = useCallback(async () => {
        try {
            const [fmResponse, validationResponse] = await Promise.all([
                authAxios.get(`${API}/data_source_field_mappings/`, {
                    params: { q: JSON.stringify({ filters: [{ col: 'data_source_model_id', opr: 'eq', value: mapping.id }] }) }
                }),
                authAxios.get(`${API}/data_source_mappings/${mapping.id}/validate`)
            ]);
            setFieldMappings(fmResponse.data?.result || []);
            setValidation(validationResponse.data?.result || null);
        } catch (err) {
            enqueueSnackbar(errorText(err, 'Could not load mapping details'), { variant: 'error' });
        }
    }, [mapping.id, enqueueSnackbar]);

    const loadColumns = useCallback(async () => {
        if (!mapping.object_name) return;
        try {
            const response = await authAxios.get(`${API}/data_sources/${mapping.data_source_id}/columns`, {
                params: { table: mapping.object_name, schema: mapping.schema_name || undefined }
            });
            setColumns(response.data?.result?.columns || []);
        } catch (err) {
            setColumns([]);
        }
    }, [mapping.data_source_id, mapping.object_name, mapping.schema_name]);

    useEffect(() => {
        loadDetails();
        loadColumns();
    }, [loadDetails, loadColumns]);

    const deleteMapping = async () => {
        setBusy(true);
        try {
            await authAxios.delete(`${API}/data_source_mappings/${mapping.id}`);
            enqueueSnackbar('Entity mapping deleted', { variant: 'success' });
            setConfirmDeleteOpen(false);
            onChanged();
        } catch (err) {
            enqueueSnackbar(errorText(err, 'Could not delete the mapping'), { variant: 'error' });
        } finally {
            setBusy(false);
        }
    };

    const runPreview = async () => {
        setPreviewOpen(true);
        setPreviewLoading(true);
        try {
            const response = await authAxios.get(`${API}/data_source_mappings/${mapping.id}/preview`, { params: { limit: 20 } });
            setPreview(response.data?.result || null);
        } catch (err) {
            setPreview({ ok: false, error: errorText(err, 'Preview failed') });
        } finally {
            setPreviewLoading(false);
        }
    };

    /**
     * Poll /sync_status until the run stops being live, then report it.
     *
     * Liveness comes from `queued`, which the server derives from the
     * scheduler and its in-flight set — never from `last_sync_status`. A run
     * interrupted by a restart (or by the synchronous /sync this replaced)
     * leaves RUNNING on the row with nothing left to clear it, so treating
     * RUNNING as live means waiting forever on a job that no longer exists,
     * with the Synchronise button disabled the whole time. `queued` spans the
     * real lifecycle — queued before start, in-flight during — and clears
     * itself when the job ends.
     */
    const pollUntilDone = useCallback(() => {
        const tick = async () => {
            try {
                const response = await authAxios.get(`${API}/data_source_mappings/${mapping.id}/sync_status`);
                const snapshot = response.data?.result || null;
                setProgress(snapshot);

                if (snapshot?.queued) {
                    pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
                    return;
                }

                setBusy(false);
                setSyncResult(snapshot?.result || null);
                reportOutcome(snapshot?.result);
                onChanged();
                loadDetails();
            } catch (err) {
                setBusy(false);
                enqueueSnackbar(errorText(err, 'Lost track of the synchronisation'), { variant: 'error' });
            }
        };
        pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapping.id, enqueueSnackbar, loadDetails, onChanged]);

    useEffect(() => () => clearTimeout(pollTimer.current), []);

    // A sync started elsewhere (another tab, or a page reload mid-run) should
    // still be followed rather than looking idle. Ask the server whether one
    // is actually live rather than inferring it from last_sync_status, which
    // cannot distinguish a running sync from an interrupted one.
    useEffect(() => {
        let cancelled = false;
        authAxios
            .get(`${API}/data_source_mappings/${mapping.id}/sync_status`)
            .then((response) => {
                if (cancelled) return;
                const snapshot = response.data?.result || null;
                setProgress(snapshot);
                if (snapshot?.queued) {
                    setBusy(true);
                    pollUntilDone();
                }
            })
            .catch(() => {
                /* The panel is still usable without it; the Sync button reports its own errors. */
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapping.id]);

    /**
     * Judge a finished run by its actual statuses.
     *
     * A run that *ran* is not a run that worked — a refused identity, or an
     * entity whose creation contract blocks every row, are ordinary reported
     * outcomes. Reporting "success" on the mere absence of a transport error
     * previously claimed a sync had worked when reconciliation had in fact
     * failed and materialisation had never been attempted.
     */
    const reportOutcome = (result) => {
        const reconciliation = result?.reconciliation;
        const materialisation = result?.materialisation;
        const reconcileFailed = reconciliation && reconciliation.status !== 'COMPLETED';
        const materialiseFailed = materialisation && materialisation.status === 'FAILED';
        const changed = (reconciliation?.created_count || 0) + (materialisation?.updated_count || 0);

        if (reconcileFailed || materialiseFailed) {
            // With per-batch commits a failure no longer implies nothing
            // landed, so say how many rows are already in rather than leaving
            // it to be inferred.
            const committed = materialisation?.committed_rows || 0;
            const suffix = committed > 0 ? ` (${committed} row(s) were already committed and remain applied)` : '';
            enqueueSnackbar((reconciliation?.error || materialisation?.error || 'Synchronisation did not complete') + suffix, {
                variant: 'error',
                autoHideDuration: 12000
            });
        } else if (changed === 0) {
            // Ran cleanly but nothing moved — most often every external
            // identity was blocked because this entity has no automatic
            // creation contract. Saying "success" here reads as "your data
            // is in", which it is not.
            enqueueSnackbar('Synchronisation completed, but nothing was created or updated — see the result below.', {
                variant: 'warning',
                autoHideDuration: 10000
            });
        } else {
            enqueueSnackbar(
                `Synchronisation completed: ${reconciliation?.created_count || 0} created, ` +
                    `${materialisation?.updated_count || 0} updated`,
                { variant: 'success' }
            );
        }
    };

    /**
     * Start a sync and follow it.
     *
     * /sync answers 202 rather than carrying the whole run on the request:
     * ASAE is ~3.6M Node rows, and a request held open that long is
     * indistinguishable from a hung one. Progress is published on the mapping
     * row and polled here, so the bar reflects the server's real position
     * rather than an animation.
     */
    const runSync = async () => {
        setBusy(true);
        setSyncResult(null);
        try {
            const response = await authAxios.post(`${API}/data_source_mappings/${mapping.id}/sync`);
            setProgress(response.data?.result || null);
            enqueueSnackbar('Synchronisation started', { variant: 'info' });
            pollUntilDone();
        } catch (err) {
            setBusy(false);
            // 409 means one is already running — not a failure, and the poller
            // should still follow the run that is in flight.
            if (err?.response?.status === 409) {
                enqueueSnackbar(errorText(err, 'A synchronisation is already running'), { variant: 'warning' });
                setBusy(true);
                pollUntilDone();
                return;
            }
            enqueueSnackbar(errorText(err, 'Could not start synchronisation'), { variant: 'error' });
        }
    };

    return (
        <MainCard
            sx={{ mb: 2 }}
            title={
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h4">{mapping.data_source_model}</Typography>
                    <Chip
                        size="small"
                        label={provider ? `${provider.driver_name} · ${provider.database}` : `source #${mapping.data_source_id}`}
                    />
                </Stack>
            }
            secondary={
                <Tooltip title="Delete this entity mapping">
                    <span>
                        <Button
                            size="small"
                            color="error"
                            startIcon={<IconTrash size={16} />}
                            disabled={busy}
                            onClick={() => setConfirmDeleteOpen(true)}
                        >
                            Delete mapping
                        </Button>
                    </span>
                </Tooltip>
            }
        >
            <Typography variant="body2" color="textSecondary">
                {mapping.schema_name ? `${mapping.schema_name}.` : ''}
                {mapping.object_name || <em>no table/view selected</em>} · identity column: <code>{mapping.external_id_column || '—'}</code>
            </Typography>

            {/* §17 -- the identity contract, stated where it is configured. */}
            <Alert severity="info" sx={{ mt: 1 }}>
                The external ID column must contain the same canonical integer IDs VIAE already uses. ID translation/crosswalks are not
                supported.
            </Alert>

            {/* §16 -- automatic creation capability, straight from the DS7 contract. */}
            {contract ? (
                <Alert severity={contract.automatic_creation_supported ? 'success' : 'warning'} sx={{ mt: 1 }}>
                    {contract.automatic_creation_supported ? (
                        <>
                            <strong>Automatic creation supported.</strong> Required external field(s):{' '}
                            {contract.creation_required_fields.join(', ') || 'none'}.
                        </>
                    ) : (
                        <>
                            <strong>Automatic creation is not currently supported for this entity.</strong> New external identities will be
                            reported but not created.
                        </>
                    )}
                </Alert>
            ) : null}

            <ValidationBanner result={validation} />

            <FieldMappingEditor
                mapping={mapping}
                contract={contract}
                columns={columns}
                fieldMappings={fieldMappings}
                onChanged={loadDetails}
            />

            <Divider sx={{ my: 2 }} />

            {/* §12 -- provenance, presented with the scope the backend actually implements. */}
            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
                <Typography variant="caption" color="textSecondary">
                    Last attempt: {mapping.last_sync_attempt_at || '—'}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                    Last success: {mapping.last_sync_success_at || '—'}
                </Typography>
                {mapping.last_sync_status ? <Chip size="small" label={mapping.last_sync_status} /> : null}
            </Stack>
            <Typography variant="caption" color="textSecondary" component="div">
                Provenance above records the <strong>field materialisation</strong> phase only; the identity-reconciliation phase reports
                its result per run rather than being persisted.
            </Typography>
            {mapping.last_sync_error ? (
                <Alert severity="error" sx={{ mt: 1 }}>
                    {mapping.last_sync_error}
                </Alert>
            ) : null}

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button startIcon={<IconEye size={18} />} onClick={runPreview}>
                    Preview
                </Button>
                <Tooltip title="Creates safe missing local identities where the creation contract permits it, then updates explicitly mapped fields from the external source. It never deletes local entities and never writes to the external source.">
                    <span>
                        <Button variant="contained" disabled={busy} onClick={runSync}>
                            {busy ? 'Synchronising…' : 'Synchronise'}
                        </Button>
                    </span>
                </Tooltip>
            </Stack>

            <SyncProgressPanel progress={progress} />
            <SyncResultPanel result={syncResult} />
            <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} preview={preview} loading={previewLoading} />

            <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Delete this entity mapping?</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" gutterBottom>
                        <strong>{mapping.data_source_model}</strong> ←{' '}
                        <code>
                            {mapping.schema_name ? `${mapping.schema_name}.` : ''}
                            {mapping.object_name}
                        </code>
                    </Typography>
                    {/* Being explicit about the blast radius: the destructive
                        part is only the configuration. Data already synced into
                        the instance stays, which is usually what people expect
                        but is worth stating before they confirm. */}
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        This removes the mapping and its {fieldMappings.length} field mapping
                        {fieldMappings.length === 1 ? '' : 's'}. Synchronisation from this source will stop.
                    </Alert>
                    <Alert severity="info" sx={{ mt: 1 }}>
                        Data already synchronised into the instance is <strong>not</strong> deleted — the {mapping.data_source_model} rows
                        and their values stay exactly as they are, simply no longer maintained by this source.
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
                    <Button color="error" variant="contained" disabled={busy} onClick={deleteMapping}>
                        {busy ? 'Deleting…' : 'Delete mapping'}
                    </Button>
                </DialogActions>
            </Dialog>
        </MainCard>
    );
};

// ---------------------------------------------------------------------------

const NewMappingDialog = ({ open, onClose, onCreated, dataSources, entities }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [form, setForm] = useState({ data_source_id: '', entity: '', schema_name: '', object_name: '', external_id_column: '' });
    const [schemas, setSchemas] = useState([]);
    const [objects, setObjects] = useState({ tables: [], views: [] });
    const [columns, setColumns] = useState([]);
    const [testing, setTesting] = useState(false);

    const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

    useEffect(() => {
        if (!form.data_source_id) return;
        authAxios
            .get(`${API}/data_sources/${form.data_source_id}/schemas`)
            .then((response) => setSchemas(response.data?.result?.schemas || []))
            .catch(() => setSchemas([]));
    }, [form.data_source_id]);

    useEffect(() => {
        if (!form.data_source_id) return;
        authAxios
            .get(`${API}/data_sources/${form.data_source_id}/tables`, { params: { schema: form.schema_name || undefined } })
            .then((response) => setObjects({ tables: response.data?.result?.tables || [], views: response.data?.result?.views || [] }))
            .catch(() => setObjects({ tables: [], views: [] }));
    }, [form.data_source_id, form.schema_name]);

    useEffect(() => {
        if (!form.data_source_id || !form.object_name) return;
        authAxios
            .get(`${API}/data_sources/${form.data_source_id}/columns`, {
                params: { table: form.object_name, schema: form.schema_name || undefined }
            })
            .then((response) => setColumns(response.data?.result?.columns || []))
            .catch(() => setColumns([]));
    }, [form.data_source_id, form.object_name, form.schema_name]);

    const testConnection = async () => {
        setTesting(true);
        try {
            const response = await authAxios.get(`${API}/data_sources/${form.data_source_id}/test_connection`);
            const result = response.data?.result;
            if (result?.ok) {
                enqueueSnackbar(`Connected. Dialect: ${result.dialect}`, { variant: 'success' });
            } else {
                enqueueSnackbar(result?.error || 'Connection failed', { variant: 'error' });
            }
        } catch (err) {
            enqueueSnackbar(errorText(err, 'Connection failed'), { variant: 'error' });
        } finally {
            setTesting(false);
        }
    };

    const create = async () => {
        try {
            await authAxios.post(`${API}/data_source_mappings/`, {
                data_source_id: form.data_source_id,
                data_source_model: form.entity,
                schema_name: form.schema_name || null,
                object_name: form.object_name,
                external_id_column: form.external_id_column
            });
            enqueueSnackbar('Mapping created', { variant: 'success' });
            onCreated();
            onClose();
        } catch (err) {
            enqueueSnackbar(errorText(err, 'Could not create the mapping'), { variant: 'error' });
        }
    };

    // Tables and views are visually distinguishable but equally selectable (§7).
    const objectOptions = [
        ...objects.tables.map((name) => ({ name, kind: 'table' })),
        ...objects.views.map((name) => ({ name, kind: 'view' }))
    ];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>New entity mapping</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Data source</InputLabel>
                        <Select
                            value={form.data_source_id}
                            label="Data source"
                            onChange={(e) =>
                                set({ data_source_id: e.target.value, schema_name: '', object_name: '', external_id_column: '' })
                            }
                        >
                            {(dataSources || []).map((ds) => (
                                <MenuItem key={ds.id} value={ds.id}>
                                    {ds.driver_name} · {ds.database} {ds.host ? `@ ${ds.host}` : ''}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button
                        size="small"
                        startIcon={<IconPlugConnected size={18} />}
                        disabled={!form.data_source_id || testing}
                        onClick={testConnection}
                    >
                        {testing ? 'Testing…' : 'Test connection'}
                    </Button>

                    <FormControl fullWidth size="small">
                        <InputLabel>Canonical entity</InputLabel>
                        <Select value={form.entity} label="Canonical entity" onChange={(e) => set({ entity: e.target.value })}>
                            {(entities || []).map((entity) => (
                                <MenuItem key={entity.entity} value={entity.entity}>
                                    {entity.entity}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Sources with no schema concept (e.g. SQLite) simply
                        report none; the field stays optional rather than
                        blocking the workflow. */}
                    <FormControl fullWidth size="small" disabled={schemas.length === 0}>
                        <InputLabel>Schema {schemas.length === 0 ? '(not applicable)' : ''}</InputLabel>
                        <Select
                            value={form.schema_name}
                            label="Schema"
                            onChange={(e) => set({ schema_name: e.target.value, object_name: '', external_id_column: '' })}
                        >
                            <MenuItem value="">
                                <em>none</em>
                            </MenuItem>
                            {schemas.map((schema) => (
                                <MenuItem key={schema} value={schema}>
                                    {schema}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel>Table / view</InputLabel>
                        <Select
                            value={form.object_name}
                            label="Table / view"
                            onChange={(e) => set({ object_name: e.target.value, external_id_column: '' })}
                        >
                            {objectOptions.map((option) => (
                                <MenuItem key={`${option.kind}:${option.name}`} value={option.name}>
                                    <Chip size="small" label={option.kind} sx={{ mr: 1 }} />
                                    {option.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small" disabled={columns.length === 0}>
                        <InputLabel>External stable ID column</InputLabel>
                        <Select
                            value={form.external_id_column}
                            label="External stable ID column"
                            onChange={(e) => set({ external_id_column: e.target.value })}
                        >
                            {columns.map((column) => (
                                <MenuItem key={column.name} value={column.name}>
                                    {column.name} ({column.type})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    disabled={!form.data_source_id || !form.entity || !form.object_name || !form.external_id_column}
                    onClick={create}
                >
                    Create mapping
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// ---------------------------------------------------------------------------

const DataSourcesPage = () => {
    // The admin back-office now carries the same instance selector the main
    // site uses (see views/admin/index.js), so this page reads the shared
    // Redux selection instead of the local picker it needed before.
    const instance = useSelector((state) => state.instance.instance);
    const { enqueueSnackbar } = useSnackbar();

    const [dataSources, setDataSources] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [entities, setEntities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);

    const contracts = useMemo(() => Object.fromEntries(entities.map((entity) => [entity.entity, entity])), [entities]);

    const load = useCallback(async () => {
        if (!instance?.id) return;
        setLoading(true);
        try {
            const [dsResponse, entitiesResponse] = await Promise.all([
                authAxios.get(`${API}/data_sources/`, {
                    params: { q: JSON.stringify({ filters: [{ col: 'dataset_instance_id', opr: 'eq', value: instance.id }] }) }
                }),
                authAxios.get(`${API}/canonical_contract/entities`)
            ]);
            const sources = dsResponse.data?.result || [];
            setDataSources(sources);
            setEntities(entitiesResponse.data?.result?.entities || []);

            const mappingResponses = await Promise.all(
                sources.map((ds) =>
                    authAxios
                        .get(`${API}/data_source_mappings/`, {
                            params: { q: JSON.stringify({ filters: [{ col: 'data_source_id', opr: 'eq', value: ds.id }] }) }
                        })
                        .then((response) => response.data?.result || [])
                        .catch(() => [])
                )
            );
            setMappings(mappingResponses.flat());
        } catch (err) {
            enqueueSnackbar(errorText(err, 'Could not load data sources'), { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [instance?.id, enqueueSnackbar]);

    useEffect(() => {
        load();
    }, [load]);

    if (!instance?.id) {
        return (
            <MainCard title="Data Sources">
                <Alert severity="info">Select a dataset instance in the top bar to configure its external sources.</Alert>
            </MainCard>
        );
    }

    return (
        <MainCard
            title="Data Sources"
            secondary={
                <Stack direction="row" spacing={1} alignItems="center">
                    <Button size="small" startIcon={<IconRefresh size={18} />} onClick={load}>
                        Refresh
                    </Button>
                    <Button size="small" variant="contained" disabled={dataSources.length === 0} onClick={() => setDialogOpen(true)}>
                        New mapping
                    </Button>
                </Stack>
            }
        >
            <Typography variant="body2" color="textSecondary" gutterBottom>
                External sources contribute explicitly mapped fields into this instance&apos;s own canonical database. Everything VIAE
                solves over keeps reading that local database — synchronising is what keeps it up to date.
            </Typography>

            {dataSources.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                    No data source is configured for this instance yet. Create one under{' '}
                    <Link href="/admin/data_sources">Admin → Data sources</Link>, then map an entity here.
                </Alert>
            ) : null}

            {loading ? (
                <Stack alignItems="center" sx={{ py: 4 }}>
                    <CircularProgress />
                </Stack>
            ) : (
                mappings.map((mapping) => (
                    <MappingPanel key={mapping.id} mapping={mapping} dataSources={dataSources} contracts={contracts} onChanged={load} />
                ))
            )}

            {!loading && dataSources.length > 0 && mappings.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                    No entity mappings yet. Use <strong>New mapping</strong> to connect a canonical entity to an external table or view.
                </Alert>
            ) : null}

            <NewMappingDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onCreated={load}
                dataSources={dataSources}
                entities={entities}
            />
        </MainCard>
    );
};

export default DataSourcesPage;
