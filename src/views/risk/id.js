/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    AppBar,
    Avatar,
    Box,
    Button,
    CardActions,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Modal,
    Select,
    Stack,
    Step,
    StepLabel,
    Stepper,
    Switch,
    Tab,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Toolbar,
    Tooltip,
    Typography
} from '@mui/material';
import {
    AutoFixHigh,
    Edit as EditIcon,
    Functions as FunctionsIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
    OpenInNew,
    Save as SaveIcon,
    Update as UpdateIcon,
    UpdateDisabled as UpdateDisabledIcon
} from '@mui/icons-material';
import { IconArrowLeft, IconCalculator, IconChevronDown, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import ReactApexChart from 'react-apexcharts';
import { useSnackbar } from 'notistack';

import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';

// ── Helpers ──────────────────────────────────────────────────────────────────

const stateColor = { PENDING: 'default', IN_PROGRESS: 'info', READY: 'success', ERROR: 'error' };

const STEPS = ['Filters', 'Risk Matrix', 'Indicators / Features', 'Collections & Formula'];

// ── Step 1: Filters ───────────────────────────────────────────────────────────

const Step1Filters = ({ model, onChange }) => (
    <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Optional node filters. Leave empty to include all nodes.
        </Typography>
        <TextField
            label="Filters (JSON)"
            multiline
            rows={4}
            fullWidth
            size="small"
            value={model.filters ? JSON.stringify(model.filters, null, 2) : ''}
            onChange={(e) => {
                try {
                    onChange({ filters: JSON.parse(e.target.value) });
                } catch (_e) {
                    /* ignore invalid */
                }
            }}
        />
        {model.node_count != null && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                {model.node_count} node(s) in scope (last calculation)
            </Typography>
        )}
    </Box>
);

// ── Level Dialogs (SAMA4: AddRiskLevelButton / EditRiskLevel) ─────────────────

const AddLevelDialog = ({ levels, onAdd }) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [value, setValue] = useState('');
    const [color, setColor] = useState('#888888');

    const handleAdd = () => {
        const maxId = levels.reduce((m, l) => Math.max(m, l.id || 0), 0);
        onAdd({ name, value: parseInt(value) || levels.length + 1, color, id: maxId + 1 });
        setName('');
        setValue('');
        setColor('#888888');
        setOpen(false);
    };

    return (
        <>
            <Button onClick={() => setOpen(true)} startIcon={<IconPlus size={16} />} size="small">
                Add level
            </Button>
            <Modal open={open} onClose={() => setOpen(false)}>
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 360,
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        boxShadow: 24,
                        p: 3
                    }}
                >
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Add Risk Level
                    </Typography>
                    <TextField required fullWidth label="Name" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
                    <TextField
                        required
                        fullWidth
                        label="Value"
                        type="number"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        required
                        fullWidth
                        label="Color"
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        <Button onClick={() => setOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={handleAdd} disabled={!name}>
                            Add
                        </Button>
                    </Stack>
                </Box>
            </Modal>
        </>
    );
};

const EditLevelDialog = ({ level, onEdit }) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(level.name);
    const [value, setValue] = useState(level.value ?? '');
    const [color, setColor] = useState(level.color || '#888888');

    const handleOpen = () => {
        setName(level.name);
        setValue(level.value ?? '');
        setColor(level.color || '#888888');
        setOpen(true);
    };

    const handleSave = () => {
        onEdit({ ...level, name, value: parseInt(value) || level.value, color });
        setOpen(false);
    };

    return (
        <>
            <IconButton size="small" onClick={handleOpen} sx={{ color: '#fff' }}>
                <IconEdit size={14} />
            </IconButton>
            <Dialog open={open} onClose={() => setOpen(false)}>
                <DialogTitle>Edit Risk Level</DialogTitle>
                <DialogContent>
                    <TextField
                        required
                        fullWidth
                        label="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        sx={{ mb: 2, mt: 1 }}
                    />
                    <TextField
                        required
                        fullWidth
                        label="Value"
                        type="number"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        required
                        fullWidth
                        label="Color"
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        sx={{ mb: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

// ── Matrix Grid Editor ────────────────────────────────────────────────────────

const MatrixGrid = ({ matrix, levels, xLength, yLength, onChange }) => {
    const [selected, setSelected] = useState(levels[0]);
    const [painting, setPainting] = useState(false);
    const [inconsistency, setInconsistency] = useState(null);

    const rows = yLength || 5;
    const cols = xLength || 5;

    const ensureMatrix = () => {
        const m = [];
        for (let r = 0; r < rows; r++) {
            m.push(Array.from({ length: cols }, (_, c) => (matrix[r] || [])[c] || levels[0]?.id || null));
        }
        return m;
    };

    const levelById = (id) => levels.find((l) => l.id === id);

    const checkInconsistencies = (m) => {
        for (let r = 0; r < rows; r++) {
            for (let c = 1; c < cols; c++) {
                const prev = levelById(m[r][c - 1]);
                const curr = levelById(m[r][c]);
                if (prev && curr && curr.value < prev.value) {
                    return `row ${rows - r}`;
                }
            }
        }
        for (let c = 0; c < cols; c++) {
            for (let r = 1; r < rows; r++) {
                const prev = levelById(m[r - 1][c]);
                const curr = levelById(m[r][c]);
                if (prev && curr && curr.value < prev.value) {
                    return `column ${c + 1}`;
                }
            }
        }
        return null;
    };

    const paint = (r, c) => {
        const m = ensureMatrix();
        m[r][c] = selected?.id || null;
        setInconsistency(checkInconsistencies(m));
        onChange(m);
    };

    const currentMatrix = ensureMatrix();

    return (
        <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                {levels.map((lvl) => (
                    <Chip
                        key={lvl.id}
                        label={lvl.name}
                        size="small"
                        sx={{
                            bgcolor: lvl.color,
                            color: '#fff',
                            cursor: 'pointer',
                            border: selected?.id === lvl.id ? '2px solid black' : '2px solid transparent'
                        }}
                        onClick={() => setSelected(lvl)}
                    />
                ))}
            </Stack>
            <Box onMouseLeave={() => setPainting(false)} sx={{ userSelect: 'none' }}>
                {[...Array(rows)].map((_, ri) => {
                    const r = rows - 1 - ri; // display top row = highest Y
                    return (
                        <Stack key={r} direction="row" spacing={0.5} sx={{ mb: 0.5 }}>
                            {[...Array(cols)].map((_, c) => {
                                const levelId = currentMatrix[r][c];
                                const lvl = levelById(levelId);
                                return (
                                    <Box
                                        key={c}
                                        sx={{
                                            width: 56,
                                            height: 56,
                                            bgcolor: lvl?.color || '#ccc',
                                            borderRadius: 1,
                                            cursor: 'crosshair',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        onMouseDown={() => {
                                            setPainting(true);
                                            paint(r, c);
                                        }}
                                        onMouseUp={() => setPainting(false)}
                                        onMouseEnter={() => {
                                            if (painting) paint(r, c);
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: '#fff',
                                                fontWeight: 600,
                                                pointerEvents: 'none',
                                                textAlign: 'center',
                                                lineHeight: 1.1,
                                                fontSize: '0.65rem'
                                            }}
                                        >
                                            {lvl?.name || ''}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Stack>
                    );
                })}
            </Box>
            {inconsistency && (
                <Alert severity="error" sx={{ mt: 1 }}>
                    Inconsistent risk values in {inconsistency}
                </Alert>
            )}
        </Box>
    );
};

// ── Step 2: Risk Matrix ───────────────────────────────────────────────────────

const Step2Matrix = ({ model, levels, onLevelChange, onMatrixChange, onAxisChange }) => (
    <Box sx={{ p: 2 }}>
        <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                    Risk Levels
                </Typography>
                <Stack spacing={1}>
                    {levels.map((lvl, i) => (
                        <Stack
                            key={lvl.id ?? i}
                            direction="row"
                            alignItems="center"
                            spacing={0.5}
                            sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: lvl.color || '#888', cursor: 'default' }}
                        >
                            <Typography sx={{ color: '#fff', flexGrow: 1, fontSize: '0.85rem' }}>{lvl.name}</Typography>
                            <EditLevelDialog
                                level={lvl}
                                onEdit={(updated) => {
                                    const next = [...levels];
                                    next[i] = updated;
                                    onLevelChange(next);
                                }}
                            />
                            <IconButton size="small" sx={{ color: '#fff' }} onClick={() => onLevelChange(levels.filter((_, j) => j !== i))}>
                                <IconTrash size={14} />
                            </IconButton>
                        </Stack>
                    ))}
                    <AddLevelDialog levels={levels} onAdd={(lvl) => onLevelChange([...levels, lvl])} />
                </Stack>

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                    Axes
                </Typography>
                <Stack spacing={1}>
                    <TextField
                        label="X Axis Name"
                        size="small"
                        value={model.x_name || ''}
                        onChange={(e) => onAxisChange({ x_name: e.target.value })}
                    />
                    <TextField
                        label="Y Axis Name"
                        size="small"
                        value={model.y_name || ''}
                        onChange={(e) => onAxisChange({ y_name: e.target.value })}
                    />
                    <TextField
                        label="X Dimension"
                        type="number"
                        size="small"
                        value={model.x_length || 5}
                        onChange={(e) => onAxisChange({ x_length: parseInt(e.target.value) || 5 })}
                        inputProps={{ min: 1, max: 10 }}
                    />
                    <TextField
                        label="Y Dimension"
                        type="number"
                        size="small"
                        value={model.y_length || 5}
                        onChange={(e) => onAxisChange({ y_length: parseInt(e.target.value) || 5 })}
                        inputProps={{ min: 1, max: 10 }}
                    />
                </Stack>
            </Grid>

            <Grid item xs={12} md={8}>
                <Typography variant="subtitle2" gutterBottom>
                    Matrix
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Click cells to paint with the selected risk level. X axis = left→right, Y axis = bottom→top (higher = riskier).
                </Typography>
                <MatrixGrid
                    matrix={model.matrix || []}
                    levels={levels}
                    xLength={model.x_length || 5}
                    yLength={model.y_length || 5}
                    onChange={onMatrixChange}
                />
            </Grid>
        </Grid>
    </Box>
);

// ── Step 3: Feature accordion helpers ────────────────────────────────────────

const WEIGHTING_LABELS = { '': 'No reference', mea: 'Mean', med: 'Median', q: 'Quartiles' };
const FEAT_API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function evalFormula(formula, x) {
    try {
        // eslint-disable-next-line no-new-func
        return new Function('x', `return (${formula})`)(x);
    } catch {
        return x;
    }
}

function buildHistogram(points) {
    const nums = points.map((p) => p.y).filter((v) => v != null && !isNaN(v));
    if (!nums.length) return null;
    const mn = Math.min(...nums);
    const mx = Math.max(...nums);
    const count = 10;
    const width = (mx - mn) / count || 1;
    const buckets = Array(count).fill(0);
    const labels = Array.from({ length: count }, (_, i) => (mn + i * width).toFixed(2));
    nums.forEach((v) => {
        const idx = Math.min(Math.floor((v - mn) / width), count - 1);
        buckets[idx]++;
    });
    return { series: [{ name: 'Count', data: buckets }], labels };
}

function applyChanges(rawValues, transformations, minVal, maxVal, defVal) {
    if (!rawValues.length) return [];
    const byNode = {};
    rawValues.forEach((r) => {
        if (!byNode[r.node_id]) byNode[r.node_id] = [];
        byNode[r.node_id].push(r);
    });
    let result = rawValues.map((r) => {
        let v = r.value ?? defVal ?? 0;
        if (minVal != null) v = Math.max(v, minVal);
        if (maxVal != null) v = Math.min(v, maxVal);
        return { ...r, y: v };
    });
    for (const t of transformations) {
        if (t.type === 'Formula' && t.value) {
            result = result.map((r) => ({ ...r, y: evalFormula(t.value, r.y) }));
        } else if (t.type === 'Categorization' && t.value?.bins) {
            result = result.map((r) => {
                const { bins, labels } = t.value;
                let cat = labels[labels.length - 1];
                for (let i = 0; i < bins.length; i++) {
                    if (r.y <= bins[i]) {
                        cat = labels[i];
                        break;
                    }
                }
                return { ...r, y: cat };
            });
        } else if ((t.type === 'avg' || t.type === 'sum') && t.value != null) {
            const ndays = Number(t.value);
            const cutoff = Date.now() - ndays * 86400000;
            result = result.map((r) => {
                const nodeRows = byNode[r.node_id] || [];
                const window = ndays > 0 ? nodeRows.filter((x) => new Date(x.created_at).getTime() >= cutoff) : nodeRows;
                const vals = window.map((x) => x.value).filter((v) => v != null);
                if (!vals.length) return r;
                const agg = t.type === 'avg' ? vals.reduce((a, b) => a + b, 0) / vals.length : vals.reduce((a, b) => a + b, 0);
                return { ...r, y: agg };
            });
        } else if (t.type === 'delta' || t.type === 'evo') {
            result = result.map((r) => {
                const nodeRows = (byNode[r.node_id] || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                if (nodeRows.length < 2) return { ...r, y: 0 };
                return { ...r, y: nodeRows[nodeRows.length - 1].value - nodeRows[nodeRows.length - 2].value };
            });
        }
    }
    return result;
}

function buildScatterSeries(points, xAxis) {
    return [
        {
            name: 'Value',
            data: points
                .map((p) => ({
                    x: xAxis === 'date' ? new Date(p.created_at).getTime() : p.node_id,
                    y: typeof p.y === 'number' ? p.y : null
                }))
                .filter((p) => p.y != null)
        }
    ];
}

function scatterOptions(xAxis) {
    return {
        chart: { type: 'scatter', toolbar: { show: false }, zoom: { enabled: false } },
        xaxis: xAxis === 'date' ? { type: 'datetime' } : { type: 'numeric', title: { text: 'Node' } },
        yaxis: { title: { text: 'Value' } },
        colors: ['#0bb'],
        markers: { size: 4 },
        dataLabels: { enabled: false }
    };
}

// ── Sub-editors ───────────────────────────────────────────────────────────────

const CategorizationEditor = ({ value, onChange }) => {
    const bins = value?.bins || [0];
    const labels = value?.labels || [0, 1];
    const setBins = (b) => onChange({ bins: b, labels });
    const setLabels = (l) => onChange({ bins, labels: l });
    const addBin = () => {
        const nb = [...bins, bins[bins.length - 1] + 1];
        const nl = [...labels, 0];
        onChange({ bins: nb, labels: nl });
    };
    const removeBin = (idx) => {
        onChange({ bins: bins.filter((_, i) => i !== idx), labels: labels.filter((_, i) => i !== idx + 1) });
    };
    return (
        <Box>
            <Typography variant="caption" color="text.secondary">
                Bins (thresholds) and resulting labels
            </Typography>
            {bins.map((b, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    <TextField
                        size="small"
                        label={`Label ≤ threshold`}
                        type="number"
                        value={labels[i]}
                        onChange={(e) => {
                            const l = [...labels];
                            l[i] = Number(e.target.value);
                            setLabels(l);
                        }}
                        sx={{ width: 140 }}
                    />
                    <TextField
                        size="small"
                        label="Threshold"
                        type="number"
                        value={b}
                        onChange={(e) => {
                            const nb = [...bins];
                            nb[i] = Number(e.target.value);
                            setBins(nb);
                        }}
                        sx={{ width: 120 }}
                    />
                    <IconButton size="small" onClick={() => removeBin(i)}>
                        <IconTrash size={12} />
                    </IconButton>
                </Stack>
            ))}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
                <TextField
                    size="small"
                    label="Label (above last threshold)"
                    type="number"
                    value={labels[labels.length - 1]}
                    onChange={(e) => {
                        const l = [...labels];
                        l[l.length - 1] = Number(e.target.value);
                        setLabels(l);
                    }}
                    sx={{ width: 200 }}
                />
                <Button size="small" onClick={addBin}>
                    + Threshold
                </Button>
            </Stack>
        </Box>
    );
};

const AggregationEditor = ({ value, onChange }) => {
    const type = value?.type || 'avg';
    const ndays = value?.ndays ?? 30;
    return (
        <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Function</InputLabel>
                <Select value={type} label="Function" onChange={(e) => onChange({ type: e.target.value, ndays })}>
                    <MenuItem value="avg">Average</MenuItem>
                    <MenuItem value="sum">Sum</MenuItem>
                </Select>
            </FormControl>
            <TextField
                size="small"
                label="N days lookback"
                type="number"
                value={ndays}
                onChange={(e) => onChange({ type, ndays: Number(e.target.value) })}
                sx={{ width: 150 }}
            />
        </Stack>
    );
};

const EvolutionEditor = ({ value, onChange }) => (
    <TextField
        size="small"
        label="N days lookback (0 = use last 2 entries)"
        type="number"
        value={value?.value ?? 0}
        onChange={(e) => onChange({ value: Number(e.target.value) })}
        sx={{ width: 280 }}
    />
);

// ── EditFeatureModal ──────────────────────────────────────────────────────────

const EditFeatureModal = ({ open, feat, onClose, onSaved }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [weighting, setWeighting] = useState('');
    const [routineMinutes, setRoutineMinutes] = useState('');

    useEffect(() => {
        if (open && feat) {
            setName(feat.name || '');
            setDescription(feat.description || '');
            setWeighting(feat.weighting || '');
            setRoutineMinutes(feat.routine_minutes ?? '');
        }
    }, [open, feat]);

    const handleSave = async () => {
        try {
            await authAxios.put(`${FEAT_API_BASE}/api/v1/risk_features/${feat.id}`, {
                name,
                description,
                weighting: weighting || null,
                routine_minutes: routineMinutes !== '' ? Number(routineMinutes) : null
            });
            onSaved({ name, description, weighting, routine_minutes: routineMinutes !== '' ? Number(routineMinutes) : null });
            onClose();
        } catch {
            enqueueSnackbar('Failed to save feature', { variant: 'error' });
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Edit Feature</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField label="Name" size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
                    <TextField
                        label="Description"
                        size="small"
                        fullWidth
                        multiline
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                    <FormControl size="small" fullWidth>
                        <InputLabel>Reference</InputLabel>
                        <Select value={weighting} label="Reference" onChange={(e) => setWeighting(e.target.value)}>
                            {Object.entries(WEIGHTING_LABELS).map(([k, v]) => (
                                <MenuItem key={k} value={k}>
                                    {v}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label="Routine Minutes"
                        size="small"
                        type="number"
                        value={routineMinutes}
                        onChange={(e) => setRoutineMinutes(e.target.value)}
                        helperText="How often to refresh indicator values"
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSave}>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// ── FeatureAccordion ──────────────────────────────────────────────────────────

const tabPanelFromTrans = (trans) =>
    trans.map((t, i) => {
        const isAgg = t.type === 'avg' || t.type === 'sum';
        const isEvo = t.type === 'delta' || t.type === 'evo';
        return {
            value: String(i + 1),
            index: i,
            type: isAgg ? 'Aggregation' : isEvo ? 'Evolution' : t.type,
            formula: isAgg ? { type: t.type, ndays: t.value } : isEvo ? { value: t.value } : t.value
        };
    });

const FeatureAccordion = ({ feat, index, isActive, onRemove, onUpdate, onExpand }) => {
    const { enqueueSnackbar } = useSnackbar();

    const [transformations, setTransformations] = useState(feat.transformation || []);
    const [tabPanels, setTabPanels] = useState(() => tabPanelFromTrans(feat.transformation || []));
    const [activeTab, setActiveTab] = useState('1');
    const [changed, setChanged] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [values, setValues] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [loadingValues, setLoadingValues] = useState(false);
    const [minDate, setMinDate] = useState('');
    const [maxDate, setMaxDate] = useState('');
    const [minVal, setMinVal] = useState(feat.min_value ?? 0);
    const [maxVal, setMaxVal] = useState(feat.max_value ?? 1);
    const [defVal, setDefVal] = useState(feat.default_value ?? 0);
    const [fullscreenMode, setFullscreenMode] = useState(null);
    const prevActive = React.useRef(false);
    const featureId = feat.feature_id ?? feat.id;

    const hasAggOrEvo = transformations.some((t) => ['avg', 'sum', 'delta', 'evo'].includes(t.type));

    const fetchValues = async (overrides = {}) => {
        if (!featureId) return;
        setLoadingValues(true);
        try {
            const qs = new URLSearchParams();
            const md = overrides.min_date !== undefined ? overrides.min_date : minDate;
            const mx = overrides.max_date !== undefined ? overrides.max_date : maxDate;
            if (md) qs.set('min_date', md);
            if (mx) qs.set('max_date', mx);
            const res = await authAxios.get(`${FEAT_API_BASE}/api/v1/risk_features/${featureId}/feature_data?${qs}`);
            setValues(res.data.values || []);
            setMetrics(res.data.metrics || null);
        } catch {
            enqueueSnackbar('Failed to load feature data', { variant: 'error' });
        } finally {
            setLoadingValues(false);
        }
    };

    useEffect(() => {
        if (isActive && !prevActive.current) {
            fetchValues();
        } else if (!isActive && prevActive.current && changed && featureId) {
            handleSave();
        }
        prevActive.current = isActive;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]);

    const handleSave = async () => {
        if (!featureId) return;
        try {
            await authAxios.put(`${FEAT_API_BASE}/api/v1/risk_features/${featureId}`, {
                transformation: transformations,
                min_value: minVal,
                max_value: maxVal,
                default_value: defVal
            });
            onUpdate(index, { transformation: transformations, min_value: minVal, max_value: maxVal, default_value: defVal });
            setChanged(false);
            enqueueSnackbar('Feature saved', { variant: 'success' });
        } catch {
            enqueueSnackbar('Failed to save feature', { variant: 'error' });
        }
    };

    const markChanged = () => {
        if (!changed) setChanged(true);
    };

    const addTransformation = (type, defaultValue) => {
        const newTrans = [...transformations, { type, value: defaultValue }];
        setTransformations(newTrans);
        setTabPanels(tabPanelFromTrans(newTrans));
        setActiveTab(String(newTrans.length));
        markChanged();
    };

    const deleteTransformation = (panel) => {
        const idx = parseInt(panel.value) - 1;
        const newTrans = transformations.filter((_, i) => i !== idx);
        const newPanels = tabPanelFromTrans(newTrans);
        setTransformations(newTrans);
        setTabPanels(newPanels);
        setActiveTab(newPanels.length ? String(Math.min(idx + 1, newPanels.length)) : '1');
        markChanged();
    };

    const updateTransformation = (idx, updated) => {
        const newTrans = transformations.map((t, i) => (i === idx ? updated : t));
        setTransformations(newTrans);
        setTabPanels(tabPanelFromTrans(newTrans));
        markChanged();
    };

    const originalPoints = useMemo(() => values.map((v) => ({ ...v, y: v.value })), [values]);
    const transformedPoints = useMemo(
        () => applyChanges(values, transformations, minVal, maxVal, defVal),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [values, JSON.stringify(transformations), minVal, maxVal, defVal]
    );

    const renderChart = (points, title) => {
        const series = buildScatterSeries(points, 'date');
        const opts = scatterOptions('date');
        const hist = buildHistogram(points);
        return (
            <Box>
                <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                    <IconButton size="small" onClick={() => setFullscreenMode(title)}>
                        <FullscreenIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="subtitle2">{title}</Typography>
                </Stack>
                <ReactApexChart type="scatter" series={series} options={opts} height={200} />
                {hist && (
                    <ReactApexChart
                        type="bar"
                        series={hist.series}
                        options={{
                            chart: { type: 'bar', toolbar: { show: false } },
                            xaxis: { categories: hist.labels, labels: { rotate: -45, style: { fontSize: '9px' } } },
                            colors: ['#0bb'],
                            plotOptions: { bar: { columnWidth: '80%' } },
                            dataLabels: { enabled: false }
                        }}
                        height={130}
                    />
                )}
            </Box>
        );
    };

    return (
        <>
            <Accordion expanded={isActive} onChange={(_, exp) => onExpand(index, exp)} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<IconChevronDown size={16} />}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                        <Chip
                            avatar={<Avatar sx={{ width: 20, height: 20, fontSize: '0.65rem' }}>{featureId || '?'}</Avatar>}
                            label={feat.name || `f${index + 1}`}
                            variant="outlined"
                            size="small"
                        />
                        {feat.routine_minutes ? (
                            <Chip
                                icon={<UpdateIcon sx={{ fontSize: 14 }} />}
                                label={`${feat.routine_minutes} min`}
                                size="small"
                                color="secondary"
                                variant="outlined"
                            />
                        ) : (
                            <Chip icon={<UpdateDisabledIcon sx={{ fontSize: 14 }} />} label="-" size="small" variant="outlined" />
                        )}
                        {feat.weighting ? (
                            <Chip
                                icon={<FunctionsIcon sx={{ fontSize: 14 }} />}
                                label={WEIGHTING_LABELS[feat.weighting] || feat.weighting}
                                size="small"
                                color="success"
                                variant="outlined"
                            />
                        ) : (
                            <Chip icon={<FunctionsIcon sx={{ fontSize: 14 }} />} label="No reference" size="small" variant="outlined" />
                        )}
                    </Stack>
                    <Stack direction="row" sx={{ flexShrink: 0 }}>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditOpen(true);
                            }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                        {featureId && (
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSave();
                                }}
                            >
                                <SaveIcon fontSize="small" />
                            </IconButton>
                        )}
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(index);
                            }}
                        >
                            <IconTrash size={14} />
                        </IconButton>
                    </Stack>
                </AccordionSummary>
                <AccordionDetails>
                    {/* Chart controls */}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <TextField
                            size="small"
                            label="From"
                            type="date"
                            value={minDate}
                            onChange={(e) => setMinDate(e.target.value)}
                            onBlur={() => fetchValues({ min_date: minDate, max_date: maxDate })}
                            InputLabelProps={{ shrink: true }}
                            sx={{ width: 180 }}
                        />
                        <TextField
                            size="small"
                            label="To"
                            type="date"
                            value={maxDate}
                            onChange={(e) => setMaxDate(e.target.value)}
                            onBlur={() => fetchValues({ min_date: minDate, max_date: maxDate })}
                            InputLabelProps={{ shrink: true }}
                            sx={{ width: 180 }}
                        />
                    </Stack>

                    {/* Charts */}
                    {loadingValues && values.length === 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <CircularProgress size={24} />
                        </Box>
                    )}
                    {!loadingValues && values.length === 0 && featureId && (
                        <Typography variant="caption" color="text.secondary">
                            No indicator values recorded yet.
                        </Typography>
                    )}
                    {values.length > 0 && !hasAggOrEvo && (
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>{renderChart(originalPoints, 'Original')}</Box>
                            <Divider orientation="vertical" flexItem />
                            <Box sx={{ flex: 1, minWidth: 0 }}>{renderChart(transformedPoints, 'Transformed')}</Box>
                        </Stack>
                    )}
                    {values.length > 0 && hasAggOrEvo && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Real-time preview unavailable when Aggregation or Evolution transformations are present.
                        </Typography>
                    )}

                    {/* Min / Max / Default + hints */}
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={4}>
                            <TextField
                                label="Min Value"
                                type="number"
                                size="small"
                                fullWidth
                                value={minVal}
                                onChange={(e) => {
                                    setMinVal(parseFloat(e.target.value) || 0);
                                    markChanged();
                                }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                Minimum ever recorded: {metrics?.min != null ? Number(metrics.min).toFixed(3) : '—'}
                            </Typography>
                        </Grid>
                        <Grid item xs={4}>
                            <TextField
                                label="Max Value"
                                type="number"
                                size="small"
                                fullWidth
                                value={maxVal}
                                onChange={(e) => {
                                    setMaxVal(parseFloat(e.target.value) || 1);
                                    markChanged();
                                }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                Maximum ever recorded: {metrics?.max != null ? Number(metrics.max).toFixed(3) : '—'}
                            </Typography>
                        </Grid>
                        <Grid item xs={4}>
                            <TextField
                                label="Default"
                                type="number"
                                size="small"
                                fullWidth
                                value={defVal}
                                onChange={(e) => {
                                    setDefVal(parseFloat(e.target.value) || 0);
                                    markChanged();
                                }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                Nodes without value: {metrics?.count_null ?? '—'}
                            </Typography>
                        </Grid>
                    </Grid>

                    {/* Transformation pipeline */}
                    <Box sx={{ mt: 2 }}>
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                            <Button size="small" variant="outlined" onClick={() => addTransformation('Formula', '')}>
                                + Formula
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => addTransformation('Categorization', { bins: [0], labels: [0, 1] })}
                            >
                                + Categorization
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => addTransformation('avg', 30)}>
                                + Aggregation
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => addTransformation('delta', 0)}>
                                + Evolution
                            </Button>
                        </Stack>
                        {tabPanels.length > 0 && (
                            <TabContext value={activeTab}>
                                <TabList onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
                                    {tabPanels.map((p) => (
                                        <Tab
                                            key={p.value}
                                            value={p.value}
                                            label={
                                                <Stack direction="row" spacing={0.5} alignItems="center">
                                                    <span>
                                                        {p.type} {p.value}
                                                    </span>
                                                    <IconButton
                                                        size="small"
                                                        component="span"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteTransformation(p);
                                                        }}
                                                        sx={{ p: 0.25 }}
                                                    >
                                                        <IconTrash size={11} />
                                                    </IconButton>
                                                </Stack>
                                            }
                                        />
                                    ))}
                                </TabList>
                                {tabPanels.map((p) => (
                                    <TabPanel key={p.value} value={p.value} sx={{ px: 0 }}>
                                        {p.type === 'Formula' && (
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Formula (use x as variable, e.g. x*2 or Math.log(x+1))"
                                                value={p.formula || ''}
                                                onChange={(e) => updateTransformation(p.index, { type: 'Formula', value: e.target.value })}
                                            />
                                        )}
                                        {p.type === 'Categorization' && (
                                            <CategorizationEditor
                                                value={p.formula}
                                                onChange={(v) => updateTransformation(p.index, { type: 'Categorization', value: v })}
                                            />
                                        )}
                                        {p.type === 'Aggregation' && (
                                            <AggregationEditor
                                                value={p.formula}
                                                onChange={(v) => updateTransformation(p.index, { type: v.type, value: v.ndays })}
                                            />
                                        )}
                                        {p.type === 'Evolution' && (
                                            <EvolutionEditor
                                                value={p.formula}
                                                onChange={(v) => updateTransformation(p.index, { type: 'delta', value: v.value })}
                                            />
                                        )}
                                    </TabPanel>
                                ))}
                            </TabContext>
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>

            <EditFeatureModal
                open={editOpen}
                feat={feat}
                onClose={() => setEditOpen(false)}
                onSaved={(updates) => onUpdate(index, updates)}
            />

            {/* Fullscreen chart */}
            <Dialog open={!!fullscreenMode} onClose={() => setFullscreenMode(null)} fullScreen>
                <AppBar sx={{ position: 'relative' }}>
                    <Toolbar>
                        <IconButton edge="start" color="inherit" onClick={() => setFullscreenMode(null)}>
                            <FullscreenExitIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2 }} variant="h6">
                            {feat.name} — {fullscreenMode}
                        </Typography>
                    </Toolbar>
                </AppBar>
                <Box sx={{ p: 2 }}>
                    {fullscreenMode &&
                        (() => {
                            const pts = fullscreenMode === 'Original' ? originalPoints : transformedPoints;
                            return (
                                <ReactApexChart
                                    type="scatter"
                                    series={buildScatterSeries(pts, 'date')}
                                    options={{
                                        ...scatterOptions('date'),
                                        chart: { ...scatterOptions('date').chart, height: window.innerHeight - 80 }
                                    }}
                                    height={window.innerHeight - 80}
                                />
                            );
                        })()}
                </Box>
            </Dialog>
        </>
    );
};

// ── Step 3: Features ──────────────────────────────────────────────────────────

const Step3Features = ({ features, indicators, models, onAdd, onRemove, onUpdate }) => {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickType, setPickType] = useState('indicator');
    const [pickId, setPickId] = useState('');
    const [activeIndex, setActiveIndex] = useState(null);

    const handleExpand = (index, expanded) => setActiveIndex(expanded ? index : null);

    const handleAdd = () => {
        onAdd(pickType === 'indicator' ? { indicator_id: parseInt(pickId) } : { submodel_id: parseInt(pickId), submodel_detail: 'v' });
        setPickerOpen(false);
        setPickId('');
    };

    return (
        <Box sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Features ({features.length})</Typography>
                <Button size="small" startIcon={<IconPlus size={14} />} onClick={() => setPickerOpen(true)}>
                    Add Feature
                </Button>
            </Stack>

            {features.map((feat, i) => (
                <FeatureAccordion
                    key={feat.id || i}
                    feat={feat}
                    index={i}
                    isActive={activeIndex === i}
                    onRemove={onRemove}
                    onUpdate={onUpdate}
                    onExpand={handleExpand}
                />
            ))}

            <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Add Feature</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <FormControl size="small" fullWidth>
                            <InputLabel>Source</InputLabel>
                            <Select
                                value={pickType}
                                label="Source"
                                onChange={(e) => {
                                    setPickType(e.target.value);
                                    setPickId('');
                                }}
                            >
                                <MenuItem value="indicator">Indicator</MenuItem>
                                <MenuItem value="submodel">Risk Model Output</MenuItem>
                            </Select>
                        </FormControl>
                        {pickType === 'indicator' ? (
                            <FormControl size="small" fullWidth>
                                <InputLabel>Indicator</InputLabel>
                                <Select value={pickId} label="Indicator" onChange={(e) => setPickId(e.target.value)}>
                                    {indicators
                                        .filter((ind) => ind.state === 'READY')
                                        .map((ind) => (
                                            <MenuItem key={ind.id} value={ind.id}>
                                                {ind.name}
                                            </MenuItem>
                                        ))}
                                </Select>
                            </FormControl>
                        ) : (
                            <FormControl size="small" fullWidth>
                                <InputLabel>Risk Model</InputLabel>
                                <Select value={pickId} label="Risk Model" onChange={(e) => setPickId(e.target.value)}>
                                    {models
                                        .filter((m) => m.state === 'READY')
                                        .map((m) => (
                                            <MenuItem key={m.id} value={m.id}>
                                                {m.name}
                                            </MenuItem>
                                        ))}
                                </Select>
                            </FormControl>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPickerOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAdd} disabled={!pickId}>
                        Add
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

// ── Shared formula helpers ────────────────────────────────────────────────────

const FormulaWithTooltips = ({ formula, featureLabels }) => {
    if (!formula) return null;
    const parts = formula.split(/(f\d+)/g);
    return (
        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>
            {parts.map((part, i) => {
                const label = featureLabels?.[part];
                return label ? (
                    <Tooltip key={i} title={label} arrow placement="top">
                        <span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>{part}</span>
                    </Tooltip>
                ) : (
                    <span key={i}>{part}</span>
                );
            })}
        </span>
    );
};

const FeatureLegend = ({ features }) => {
    if (!features?.length) return null;
    return (
        <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Feature variables:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {features.map((f) => (
                    <Chip
                        key={f.id}
                        size="small"
                        variant="outlined"
                        label={`f${f.id} = ${f.name}`}
                        sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                ))}
            </Box>
        </Box>
    );
};

// ── Step 4: Formula Configuration (per axis) ─────────────────────────────────

const FormulaConfigCard = ({ model, axis, features, onModelChange }) => {
    const axisName = model[axis + '_name'] || (axis === 'x' ? 'X Axis' : 'Y Axis');
    const { enqueueSnackbar } = useSnackbar();

    const [mode, setMode] = useState('auto');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [collections, setCollections] = useState([]);
    const [loadingCollections, setLoadingCollections] = useState(false);
    const [selectedCollection, setSelectedCollection] = useState(null);
    const [formula, setFormula] = useState(model[axis + '_formula'] || '');
    const [positions, setPositions] = useState([]);
    const [loadingPositions, setLoadingPositions] = useState(false);
    const [persisting, setPersisting] = useState(false);

    // If the model already has a linked dataset, load it
    useEffect(() => {
        const dsId = model[axis + '_collection_id'];
        if (dsId && !selectedCollection) {
            authAxios
                .get(`http://localhost:5000/api/v1/risk_collections/${dsId}`)
                .then((r) => setSelectedCollection(r.data.result))
                .catch(() => {});
        }
    }, []);

    // Load positions whenever selected collection changes
    useEffect(() => {
        if (!selectedCollection?.id) {
            setPositions([]);
            return;
        }
        setLoadingPositions(true);
        authAxios
            .get(`http://localhost:5000/api/v1/risk_collections/${selectedCollection.id}/calibration`)
            .then((r) => setPositions(r.data?.result || []))
            .catch(() => {})
            .finally(() => setLoadingPositions(false));
    }, [selectedCollection?.id]);

    const fetchCollections = () => {
        setLoadingCollections(true);
        authAxios
            .get(`http://localhost:5000/api/v1/risk_models/${model.id}/collections`)
            .then((r) => setCollections(r.data?.result || []))
            .catch(() => enqueueSnackbar('Failed to load collections', { variant: 'error' }))
            .finally(() => setLoadingCollections(false));
    };

    const handleOpenDialog = () => {
        fetchCollections();
        setDialogOpen(true);
    };

    const handlePickCollection = (collection) => {
        setSelectedCollection(collection);
        const formulaByModel = {
            linear_regression: collection.formula,
            lasso: collection.formula_lasso,
            ridge: collection.formula_ridge,
            elasticnet: collection.formula_elasticnet,
            polynomial: collection.formula_poly,
            linear_svm: collection.formula_svm,
            pysr: collection.formula_pysr
        };
        const best = collection.best_model;
        setFormula((best && formulaByModel[best]) || collection.formula || '');
        setDialogOpen(false);
    };

    const handleCreateCollection = () => {
        authAxios
            .post('http://localhost:5000/api/v1/risk_collections/', { model_id: model.id })
            .then((r) => {
                const newId = r.data?.id;
                if (newId) window.open(`/risk/collections/${newId}`, '_blank');
            })
            .catch(() => enqueueSnackbar('Failed to create collection', { variant: 'error' }));
    };

    const handlePersist = () => {
        setPersisting(true);
        const payload = {
            [axis + '_formula']: formula,
            [axis + '_collection_id']: selectedCollection?.id ?? null
        };
        authAxios
            .put(`http://localhost:5000/api/v1/risk_models/${model.id}`, payload)
            .then(() => {
                enqueueSnackbar('Formula saved', { variant: 'success' });
                onModelChange(payload);
            })
            .catch(() => enqueueSnackbar('Failed to save formula', { variant: 'error' }))
            .finally(() => setPersisting(false));
    };

    const featureLabels = useMemo(() => Object.fromEntries((features || []).map((f) => [`f${f.id}`, f.name])), [features]);

    const collectionColumns = useMemo(
        () => [
            { accessorKey: 'id', header: 'ID', size: 60 },
            { accessorKey: 'n_comparisons', header: '# Comparisons', size: 130 },
            { accessorKey: 'n_conflicts', header: '# Conflicts', size: 100 },
            {
                accessorKey: 'formula',
                header: 'Formula',
                size: 220,
                Cell: ({ cell }) =>
                    cell.getValue() ? (
                        <FormulaWithTooltips formula={cell.getValue()} featureLabels={featureLabels} />
                    ) : (
                        <Typography variant="caption" color="text.disabled">
                            —
                        </Typography>
                    )
            },
            {
                id: 'open',
                header: '',
                size: 50,
                enableSorting: false,
                Cell: ({ row }) => (
                    <IconButton
                        size="small"
                        title="Open collection"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/risk/collections/${row.original.id}`, '_blank');
                        }}
                    >
                        <OpenInNew fontSize="small" />
                    </IconButton>
                )
            }
        ],
        [featureLabels]
    );

    const collectionTable = useMaterialReactTable({
        columns: collectionColumns,
        data: collections,
        state: { isLoading: loadingCollections },
        enableColumnActions: false,
        enableGlobalFilter: false,
        enableDensityToggle: false,
        enableFullScreenToggle: false,
        positionToolbarAlertBanner: 'none',
        initialState: { density: 'compact' },
        muiTableBodyRowProps: ({ row }) => ({
            onClick: () => handlePickCollection(row.original),
            sx: { cursor: 'pointer' }
        })
    });

    // Apply formula string to node_details dict → numeric value (no external deps)
    const evalFormula = useCallback(
        (nodeDetails) => {
            if (!formula || !nodeDetails) return null;
            try {
                let expr = formula;
                Object.entries(nodeDetails).forEach(([k, v]) => {
                    expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), v);
                });
                // eslint-disable-next-line no-new-func
                return Function(`"use strict"; return (${expr})`)();
            } catch {
                return null;
            }
        },
        [formula]
    );

    // Calibrated rows: each position augmented with formula_value + model_position
    const calibratedPositions = useMemo(() => {
        if (!positions.length) return [];
        const withValues = positions.map((row) => ({ ...row, formula_value: evalFormula(row.node_details) }));
        // Sort by formula_value descending to assign model_position
        const sorted = [...withValues].sort((a, b) => {
            if (a.formula_value == null) return 1;
            if (b.formula_value == null) return -1;
            return b.formula_value - a.formula_value;
        });
        sorted.forEach((row, i) => {
            row.model_position = i + 1;
        });
        // Restore original sort by Copeland position for display
        return sorted.sort((a, b) => a.position - b.position);
    }, [positions, evalFormula]);

    const hasFormula = Boolean(formula);

    const positionColumns = useMemo(
        () => [
            { accessorKey: 'position', header: 'Copeland Rank', size: 90 },
            { accessorKey: 'node_id', header: 'Node', size: 70 },
            {
                accessorKey: 'score',
                header: 'Copeland Score',
                size: 110,
                Cell: ({ cell }) => Number(cell.getValue()).toFixed(1)
            },
            ...(hasFormula
                ? [
                      {
                          accessorKey: 'formula_value',
                          header: 'Formula Value',
                          size: 110,
                          Cell: ({ cell }) => (cell.getValue() != null ? Number(cell.getValue()).toFixed(4) : '—')
                      },
                      {
                          accessorKey: 'model_position',
                          header: 'Formula Rank',
                          size: 90,
                          Cell: ({ row }) => {
                              const diff = row.original.position - row.original.model_position;
                              const color = diff > 0 ? 'success.main' : diff < 0 ? 'error.main' : 'text.secondary';
                              return (
                                  <Box component="span" sx={{ color }}>
                                      {row.original.model_position}
                                      {diff !== 0 && (
                                          <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                                              ({diff > 0 ? '+' : ''}
                                              {diff})
                                          </Typography>
                                      )}
                                  </Box>
                              );
                          }
                      }
                  ]
                : [])
        ],
        [hasFormula]
    );

    const positionTable = useMaterialReactTable({
        columns: positionColumns,
        data: calibratedPositions,
        getRowId: (row) => String(row.node_id),
        state: { isLoading: loadingPositions },
        enableColumnActions: false,
        enableGlobalFilter: false,
        enableDensityToggle: false,
        enableFullScreenToggle: false,
        positionToolbarAlertBanner: 'none',
        initialState: { density: 'compact', sorting: [{ id: 'position', desc: false }] }
    });

    const varList = features.map((f, i) => `f${f.id ?? i + 1}`).join(', ');

    return (
        <>
            {/* Collection picker dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Select a Collection</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Click a row to use that collection&apos;s formula.
                    </Typography>
                    <MaterialReactTable table={collectionTable} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCreateCollection} startIcon={<IconPlus size={16} />}>
                        New Collection
                    </Button>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                </DialogActions>
            </Dialog>

            <MainCard
                title={
                    <>
                        {axisName}{' '}
                        <Typography variant="subtitle2" component="span">
                            [{axis.toUpperCase()} axis]
                        </Typography>
                    </>
                }
                sx={{ minHeight: '100%' }}
            >
                {/* AUTO / MANUAL toggle */}
                <Box display="flex" justifyContent="center" mb={2}>
                    <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => v && setMode(v)} size="small" aria-label="formula mode">
                        <ToggleButton value="auto">AUTO</ToggleButton>
                        <ToggleButton value="manual">MANUAL</ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                {mode === 'auto' ? (
                    <Box display="flex" flexDirection="column" alignItems="center" gap={1} sx={{ mb: 2 }}>
                        <Button variant="contained" onClick={handleOpenDialog} endIcon={<AutoFixHigh />}>
                            Formula from Collection
                        </Button>
                        {selectedCollection && (
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Typography variant="caption" color="text.secondary">
                                    Collection #{selectedCollection.id}
                                </Typography>
                                <IconButton
                                    size="small"
                                    title="Open collection"
                                    onClick={() => window.open(`/risk/collections/${selectedCollection.id}`, '_blank')}
                                >
                                    <OpenInNew sx={{ fontSize: 14 }} />
                                </IconButton>
                            </Stack>
                        )}
                        {formula && (
                            <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1, width: '100%', wordBreak: 'break-all' }}>
                                <FormulaWithTooltips formula={formula} featureLabels={featureLabels} />
                            </Box>
                        )}
                        <FeatureLegend features={features} />
                    </Box>
                ) : (
                    <>
                        <TextField
                            label={`${axisName} Formula`}
                            multiline
                            rows={3}
                            fullWidth
                            size="small"
                            value={formula}
                            onChange={(e) => setFormula(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <FeatureLegend features={features} />
                    </>
                )}

                <Button onClick={handlePersist} disabled={persisting || !formula}>
                    {persisting ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
                    Persist Formula
                </Button>

                {/* Calibration table */}
                {positions.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="h5" gutterBottom>
                            Formula Calibration
                        </Typography>
                        <MaterialReactTable table={positionTable} />
                    </Box>
                )}
            </MainCard>
        </>
    );
};

const Step4Formula = ({ model, features, onChange }) => {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const [activating, setActivating] = useState(false);

    const handleActivate = () => {
        setActivating(true);
        authAxios
            .post(`http://localhost:5000/api/v1/risk_models/${model.id}/calculate`)
            .then(() => {
                enqueueSnackbar('Risk model calculation scheduled', { variant: 'success' });
                navigate('/risk');
            })
            .catch(() => enqueueSnackbar('Failed to activate model', { variant: 'error' }))
            .finally(() => setActivating(false));
    };

    return (
        <Box sx={{ p: 1 }}>
            <Grid container spacing={2}>
                <Grid item xs={12} md={model.y_length > 1 ? 6 : 12}>
                    <FormulaConfigCard model={model} axis="x" features={features} onModelChange={onChange} />
                </Grid>
                {model.y_length > 1 && (
                    <Grid item xs={12} md={6}>
                        <FormulaConfigCard model={model} axis="y" features={features} onModelChange={onChange} />
                    </Grid>
                )}
            </Grid>
            <CardActions sx={{ mt: 2, justifyContent: 'flex-end' }}>
                <Button variant="contained" color="primary" onClick={handleActivate} disabled={activating}>
                    {activating ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                    Activate
                </Button>
            </CardActions>
        </Box>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const RiskModelPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const instance = useSelector((state) => state.instance.instance);
    const { enqueueSnackbar } = useSnackbar();

    const [model, setModel] = useState(null);
    const [levels, setLevels] = useState([]);
    const [features, setFeatures] = useState([]);
    const [indicators, setIndicators] = useState([]);
    const [allModels, setAllModels] = useState([]);
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchModel = useCallback(() => {
        if (!id) return;
        setLoading(true);
        Promise.all([authAxios.get(`http://localhost:5000/api/v1/risk_models/${id}`)])
            .then(([r]) => {
                const m = r.data?.result || r.data;
                setModel(m);
                setLevels(m.levels || []);
                setFeatures(m.features || []);
            })
            .catch(() => enqueueSnackbar('Failed to load model', { variant: 'error' }))
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        fetchModel();
    }, [fetchModel]);

    useEffect(() => {
        if (!instance) return;
        authAxios
            .get(`http://localhost:5000/api/v1/dataset_instances/${instance.id}/risk_indicators`)
            .then((r) => setIndicators(r.data?.result || []))
            .catch(() => {});
        authAxios
            .get(`http://localhost:5000/api/v1/dataset_instances/${instance.id}/risk_models`)
            .then((r) => setAllModels(r.data?.result || []))
            .catch(() => {});
    }, [instance]);

    const handleModelChange = (patch) => setModel((m) => ({ ...m, ...patch }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await authAxios.put(`http://localhost:5000/api/v1/risk_models/${id}`, {
                name: model.name,
                description: model.description,
                matrix: model.matrix,
                x_length: model.x_length,
                y_length: model.y_length,
                x_name: model.x_name,
                x_formula: model.x_formula,
                y_name: model.y_name,
                y_formula: model.y_formula,
                filters: model.filters,
                enabled: model.enabled
            });

            // Save levels
            for (const lvl of levels) {
                if (lvl.id) {
                    await authAxios.put(`http://localhost:5000/api/v1/risk_levels/${lvl.id}`, {
                        name: lvl.name,
                        color: lvl.color,
                        value: lvl.value
                    });
                } else {
                    await authAxios.post('http://localhost:5000/api/v1/risk_levels/', {
                        model_id: parseInt(id),
                        name: lvl.name,
                        color: lvl.color,
                        value: lvl.value
                    });
                }
            }

            // Save features (upsert)
            for (const feat of features) {
                const payload = {
                    model_id: parseInt(id),
                    name: feat.name || `f${feat.id}`,
                    indicator_id: feat.indicator_id || null,
                    submodel_id: feat.submodel_id || null,
                    submodel_detail: feat.submodel_detail || null,
                    min_value: feat.min_value ?? 0,
                    max_value: feat.max_value ?? 1,
                    default_value: feat.default_value ?? 0,
                    min_final_value: feat.min_final_value ?? 0,
                    max_final_value: feat.max_final_value ?? 1,
                    transformation: feat.transformation || null,
                    weighting: feat.weighting || null,
                    routine_minutes: feat.routine_minutes || 0
                };
                if (feat.id) {
                    await authAxios.put(`http://localhost:5000/api/v1/risk_features/${feat.id}`, payload);
                } else {
                    await authAxios.post('http://localhost:5000/api/v1/risk_features/', payload);
                }
            }

            enqueueSnackbar('Saved', { variant: 'success' });
            fetchModel();
        } catch (e) {
            enqueueSnackbar(e?.response?.data?.error || 'Save failed', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleCalculate = () => {
        authAxios
            .post(`http://localhost:5000/api/v1/risk_models/${id}/calculate`)
            .then(() => {
                enqueueSnackbar('Calculation scheduled', { variant: 'info' });
                setTimeout(fetchModel, 3000);
            })
            .catch((e) => enqueueSnackbar(e?.response?.data?.error || 'Failed', { variant: 'error' }));
    };

    if (loading)
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
            </Box>
        );
    if (!model) return null;

    return (
        <MainCard
            title={
                <Stack direction="row" spacing={2} alignItems="center">
                    <IconButton size="small" onClick={() => navigate('/risk')}>
                        <IconArrowLeft size={18} />
                    </IconButton>
                    <TextField
                        size="small"
                        value={model.name || ''}
                        onChange={(e) => handleModelChange({ name: e.target.value })}
                        variant="standard"
                        sx={{ minWidth: 200 }}
                    />
                    <Chip label={model.state || 'PENDING'} size="small" color={stateColor[model.state] || 'default'} />
                    <Switch size="small" checked={!!model.enabled} onChange={(e) => handleModelChange({ enabled: e.target.checked })} />
                    <Typography variant="caption">Enabled</Typography>
                </Stack>
            }
            secondary={
                <Stack direction="row" spacing={1}>
                    <Button size="small" startIcon={<IconCalculator size={16} />} onClick={handleCalculate}>
                        Calculate
                    </Button>
                    <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
                        {saving ? <CircularProgress size={16} /> : 'Save'}
                    </Button>
                </Stack>
            }
        >
            <Stepper activeStep={step} sx={{ mb: 3 }}>
                {STEPS.map((label, i) => (
                    <Step key={label} onClick={() => setStep(i)} sx={{ cursor: 'pointer' }}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            {step === 0 && <Step1Filters model={model} onChange={handleModelChange} />}

            {step === 1 && (
                <Step2Matrix
                    model={model}
                    levels={levels}
                    onLevelChange={setLevels}
                    onMatrixChange={(matrix) => handleModelChange({ matrix })}
                    onAxisChange={handleModelChange}
                />
            )}

            {step === 2 && (
                <Step3Features
                    features={features}
                    indicators={indicators}
                    models={allModels.filter((m) => String(m.id) !== String(id))}
                    onAdd={(newFeat) => setFeatures([...features, { name: '', min_value: 0, max_value: 1, default_value: 0, ...newFeat }])}
                    onRemove={(i) => setFeatures(features.filter((_, j) => j !== i))}
                    onUpdate={(i, patch) => {
                        const updated = [...features];
                        updated[i] = { ...updated[i], ...patch };
                        setFeatures(updated);
                    }}
                />
            )}

            {step === 3 && <Step4Formula model={model} features={features} onChange={handleModelChange} />}

            <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
                <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                    Back
                </Button>
                {step < STEPS.length - 1 ? (
                    <Button variant="contained" onClick={() => setStep((s) => s + 1)}>
                        Next
                    </Button>
                ) : (
                    <Button variant="contained" onClick={handleSave} disabled={saving}>
                        {saving ? <CircularProgress size={16} /> : 'Save & Finish'}
                    </Button>
                )}
            </Stack>
        </MainCard>
    );
};

export default RiskModelPage;
