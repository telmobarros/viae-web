import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Box,
    Chip,
    Switch,
    FormControlLabel,
    Grid,
    Typography,
    Checkbox,
    TextField,
    Button,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Tooltip,
    FormGroup,
    FormControl,
    Select,
    MenuItem,
    CircularProgress
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { IconArrowDown, IconArrowUp, IconTrash, IconGripVertical, IconLifebuoy } from '@tabler/icons-react';

// project imports
import MainCard from 'ui-component/cards/MainCard';

import authAxios from 'utils/axios';

// common objectives
import objectivesLabels from 'utils/objectivesLabels';
import SelectOFComparisonCollectionDialog from './SelectOFComparisonCollectionDialog';
import { AutoFixHigh } from '@mui/icons-material';

// Styled Toggle Switch
const StyledSwitch = styled(Switch)(({ theme }) => ({
    '& .MuiSwitch-switchBase.Mui-checked': {
        color: theme.palette.secondary.main
    },
    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
        backgroundColor: theme.palette.secondary.main
    }
}));

const initialObjectives = [{ value: 'cost', type: 'min' }];

/**
 * Self-contained objective-function editor for a single ProblemInstance.
 * Extracted from objective-function/index.js so it can be embedded both by
 * that page's own dataset-instance -> problem-instance picker, and by the
 * problem-instances page's per-variant detail panel (which already knows
 * which problemInstanceId is selected and has no picker of its own here).
 */
const ObjectiveFunctionEditor = ({ problemInstanceId }) => {
    const theme = useTheme();
    const [isAdvanced, setIsAdvanced] = useState(false);
    const [lexicographicalObjectives, setLexicographicalObjectives] = useState(initialObjectives);
    const [selectedObjectives, setSelectedObjectives] = useState(['cost']);
    const [weights, setWeights] = useState({ cost: 1 }); // Weights for objectives
    const OBJECTIVE_STORAGE_KEY = 'objectiveDefinition.v2';

    const instance = useSelector((state) => state.instance.instance);

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();

    const [suggestedObjective, setSuggestedObjective] = useState(null);
    const [selectedOFComparisonCollection, setSelectedOFComparisonCollection] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [savingObjective, setSavingObjective] = useState(false);
    const [riskModels, setRiskModels] = useState([]);
    // Pass 12 / D7: weighted criteria are an ARRAY, symmetric with the
    // lexicographic one. The old flat {metric: number} map could not carry a
    // per-criterion risk_model_id at all, which is why risk metrics could never
    // be weighted, and deleting a metric could leave an orphan weight behind.
    const [weightedObjectives, setWeightedObjectives] = useState([]);

    const handleOpenDialog = () => setDialogOpen(true);
    const handleCloseDialog = () => setDialogOpen(false);

    const handleSelectOFComparisonCollection = (ofComparisonCollection) => {
        setSelectedOFComparisonCollection(ofComparisonCollection);
        setDialogOpen(false);
    };

    useEffect(() => {
        const updateSuggestedObjective = () => {
            const ofcc = selectedOFComparisonCollection;
            if (!ofcc) return;
            const best_model = ofcc.best_model;
            // check selectedOFComparisonCollection for suggested objective
            // access feature_importance property and set the suggestedObjective to the objective with the highest feature_importance not already in use
            // if no feature_importance property, set the suggestedObjective to the first objective not already in use
            if (ofcc.metrics[best_model].hasOwnProperty('feature_importance')) {
                const featureImportance = ofcc.metrics[best_model].feature_importance;

                // Sort the objectives based on their importance in descending order
                const sortedObjectives = Object.keys(featureImportance).sort((a, b) => featureImportance[b] - featureImportance[a]);

                // Find the first objective not already selected
                const suggestedObjective = sortedObjectives.find((objective) => !selectedObjectives.includes(objective));

                setSuggestedObjective(suggestedObjective);
            } else {
                setSuggestedObjective(null);
            }
        };

        updateSuggestedObjective();
    }, [selectedOFComparisonCollection, selectedObjectives]);

    // Hydrate from localStorage if the user defined objectives elsewhere
    useEffect(() => {
        try {
            const raw = localStorage.getItem(OBJECTIVE_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed.mode) {
                setIsAdvanced(parsed.mode === 'weighted');
            }
            if (parsed.lexicographic && Array.isArray(parsed.lexicographic) && parsed.lexicographic.length) {
                setLexicographicalObjectives(parsed.lexicographic);
                setSelectedObjectives(parsed.lexicographic.map((o) => o.value));
            }
            if (parsed.selectedObjectives && Array.isArray(parsed.selectedObjectives) && parsed.selectedObjectives.length) {
                setSelectedObjectives(parsed.selectedObjectives);
            }
            if (parsed.weights) {
                setWeights(parsed.weights);
            }
        } catch (e) {
            // ignore malformed persisted data
        }
    }, []);

    useEffect(() => {
        if (!instance) return;
        authAxios
            .get(`http://localhost:5000/api/v1/dataset_instances/${instance.id}/risk_models`)
            .then((res) => {
                // Pass 12 / D7: risk models are BINDINGS for the unserved_risk
                // criterion, not metrics of their own. Keyed on `m.id` -- the
                // previous code read `m.model_id`, which this endpoint does not
                // return, so every model collapsed to the same "risk_undefined".
                //
                // The PICKER offers READY && enabled, but `enabled` is only
                // visibility: a criterion already bound to a READY model keeps
                // working if the model is later disabled, so an existing
                // objective never silently breaks. See restoreRiskModels().
                const ready = (res.data?.result || []).filter((m) => m.state === 'READY');
                setRiskModels(ready);
            })
            .catch(() => setRiskModels([]));
    }, [instance]);

    // Load persisted objective for the selected problem instance
    useEffect(() => {
        const loadObjectiveFromServer = async () => {
            if (!problemInstanceId) return;
            try {
                const resp = await authAxios.get(`http://localhost:5000/api/v1/problem_instances/${problemInstanceId}`);
                let obj = resp.data?.result?.objective_function;
                if (typeof obj === 'string') {
                    try {
                        obj = JSON.parse(obj);
                    } catch (parseErr) {
                        obj = null;
                    }
                }
                if (obj && typeof obj === 'object') {
                    setIsAdvanced((obj.mode || 'lexicographic') === 'weighted');

                    // Read BOTH shapes. Canonical uses `metric`; legacy uses
                    // `value` and a flat weights map. Without the legacy branch
                    // every previously-saved instance would open blank.
                    const readCriterion = (o) => ({
                        value: o.metric || o.value,
                        type: o.type || 'min',
                        weight: o.weight,
                        riskModelId: o.risk_model_id ?? null
                    });

                    if (Array.isArray(obj.lexicographic) && obj.lexicographic.length) {
                        const lex = obj.lexicographic.map(readCriterion);
                        setLexicographicalObjectives(lex);
                        setSelectedObjectives(lex.map((o) => o.value));
                    }
                    if (Array.isArray(obj.weighted) && obj.weighted.length) {
                        const w = obj.weighted.map(readCriterion);
                        setWeightedObjectives(w);
                        setSelectedObjectives((prev) => (prev.length ? prev : w.map((o) => o.value)));
                        setWeights(Object.fromEntries(w.map((o) => [o.value, o.weight ?? 1])));
                    } else if (obj.weights) {
                        setWeights(obj.weights);
                        setWeightedObjectives(
                            Object.entries(obj.weights).map(([metric, weight]) => ({
                                value: metric,
                                type: Number(weight) < 0 ? 'max' : 'min',
                                weight: Math.abs(Number(weight)),
                                riskModelId: null
                            }))
                        );
                    }
                }
            } catch (e) {
                // ignore and keep defaults/local
            }
        };
        loadObjectiveFromServer();
    }, [problemInstanceId]);

    // Persist current objective definition for reuse in solver configuration (minimal payload)
    useEffect(() => {
        const payload = isAdvanced ? { mode: 'weighted', weights } : { mode: 'lexicographic', lexicographic: lexicographicalObjectives };
        try {
            localStorage.setItem(OBJECTIVE_STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {
            // best effort; ignore quota errors
        }
    }, [isAdvanced, lexicographicalObjectives, weights, selectedObjectives]);

    const handleToggleChange = (event) => {
        setIsAdvanced(event.target.checked);
    };

    // Risk models are no longer pseudo-metrics, so the selectable metric list is
    // simply the canonical one.
    const allObjectives = objectivesLabels;

    // Models offered by the picker: READY and enabled. A model that is READY but
    // DISABLED is not offered for NEW criteria, yet is still shown (and kept) if
    // an existing criterion is already bound to it -- otherwise editing an
    // objective would silently drop a binding that still solves fine.
    const selectableRiskModels = riskModels.filter((m) => m.enabled);
    const boundRiskModelIds = [...lexicographicalObjectives, ...weightedObjectives]
        .map((o) => o.riskModelId)
        .filter((id) => id !== null && id !== undefined);
    const riskModelOptions = [...selectableRiskModels, ...riskModels.filter((m) => !m.enabled && boundRiskModelIds.includes(m.id))];

    const handleAddObjective = (objective) => {
        if (!selectedObjectives.includes(objective)) {
            setLexicographicalObjectives([
                ...lexicographicalObjectives,
                {
                    value: objective,
                    type: 'min',
                    riskModelId: null
                }
            ]);
            setSelectedObjectives([...selectedObjectives, objective]);
            setWeights({ ...weights, [objective]: 1 }); // Add default weight
        }
    };

    const handleRemoveObjective = (value) => {
        if (lexicographicalObjectives.length === 1) {
            enqueueSnackbar('At least one objective must be selected', { variant: 'warning' });
            return;
        }
        // if the objective the user is trying to delete is the only one with a non-zero weight, alert the user
        if (weights[value] !== 0 && Object.values(weights).filter((weight) => weight !== 0).length === 1) {
            enqueueSnackbar('At least one objective must have a non-zero weight', { variant: 'warning' });
            return;
        }
        const updatedObjectives = lexicographicalObjectives.filter((objective) => objective.value !== value);
        setLexicographicalObjectives(updatedObjectives);
        setSelectedObjectives(updatedObjectives.map((obj) => obj.value));
        const updatedWeights = { ...weights };
        delete updatedWeights[value];
        setWeights(updatedWeights);
    };

    // Pass 12 / D7: bind a RiskModel to ONE criterion. Stored on the criterion
    // itself, so deleting the criterion deletes the binding and no orphan
    // configuration can survive.
    const handleRiskModelChange = (value, modelId) => {
        const bind = (list) => list.map((o) => (o.value === value ? { ...o, riskModelId: modelId } : o));
        setLexicographicalObjectives((prev) => bind(prev));
        setWeightedObjectives((prev) => bind(prev));
    };

    // A risk criterion with no model selected must not be saveable: the backend
    // rejects it, and the UI should not be able to produce a document the API
    // will refuse.
    const unboundRiskCriteria = (isAdvanced ? weightedObjectives : lexicographicalObjectives).filter(
        (o) => o.value === 'unserved_risk' && !o.riskModelId
    );
    const hasUnboundRisk = unboundRiskCriteria.length > 0;

    const handleTypeChange = (value, newType) => {
        const updatedObjectives = lexicographicalObjectives.map((objective) =>
            objective.value === value ? { ...objective, type: newType } : objective
        );
        setLexicographicalObjectives(updatedObjectives);
    };

    const handleWeightChange = (value, newWeight) => {
        // if every weight is 0 do not perform the change and alert the user
        if (Object.values({ ...weights, [value]: newWeight }).every((weight) => weight === 0)) {
            enqueueSnackbar('At least one objective must have a non-zero weight', { variant: 'warning' });
            return;
        }
        setWeights({ ...weights, [value]: newWeight });
    };

    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const reorderedObjectives = Array.from(lexicographicalObjectives);
        const [removed] = reorderedObjectives.splice(result.source.index, 1);
        reorderedObjectives.splice(result.destination.index, 0, removed);

        setLexicographicalObjectives(reorderedObjectives);
    };

    const moveObjective = (index, direction) => {
        const reorderedObjectives = [...lexicographicalObjectives];
        const [removed] = reorderedObjectives.splice(index, 1);
        reorderedObjectives.splice(index + direction, 0, removed);
        setLexicographicalObjectives(reorderedObjectives);
    };

    const handleCheckboxChange = (event) => {
        const objective = event.target.value;

        if (event.target.checked) {
            handleAddObjective(objective);
        } else {
            handleRemoveObjective(objective);
        }
    };

    const automaticOFDefinition = () => {
        if (!selectedOFComparisonCollection) {
            enqueueSnackbar('Please select an OF Comparison Collection', { variant: 'warning' });
            return;
        }

        const ofcc = selectedOFComparisonCollection;
        authAxios
            .get(`http://localhost:5000/api/v1/of_comparison_collections/${ofcc.id}/formulas`, {
                params: {
                    features: JSON.stringify(selectedObjectives)
                }
            })
            .then((apiResponse) => {
                const best_model = apiResponse.data.best_model;
                const coefficients = apiResponse.data.metrics[best_model].coefficients;
                const featureImportance = apiResponse.data.metrics[best_model].feature_importance;

                // simple mode
                const sortedObjectives = Object.keys(featureImportance).sort((a, b) => featureImportance[b] - featureImportance[a]);
                const newLexicographicalObjectives = sortedObjectives.map((objective) => ({
                    value: objective,
                    type: coefficients[objective] > 0 ? 'min' : 'max'
                }));
                setLexicographicalObjectives(newLexicographicalObjectives);

                // advanced mode
                let newWeights = {};
                for (const [objective, coefficient] of Object.entries(coefficients)) {
                    newWeights[objective] = coefficient;
                }
                setWeights(newWeights);
            })
            .catch((error) => {
                console.log(error);
            });
    };

    const handleSaveObjective = async () => {
        if (!problemInstanceId) {
            enqueueSnackbar('Select a problem instance first', { variant: 'warning' });
            return;
        }
        const buildCriterion = (o, weighted) => ({
            metric: o.value,
            type: o.type || 'min',
            ...(weighted ? { weight: Number(o.weight) || 0 } : {}),
            // A stale binding is stripped rather than sent: the backend rejects a
            // risk_model_id on a metric that consumes no risk, and the UI must not
            // be able to produce a document the API will refuse.
            ...(o.value === 'unserved_risk' ? { risk_model_id: o.riskModelId } : {})
        });

        // Canonical schema_version 2 for EVERY save. The legacy flat weights map
        // has nowhere to put a per-criterion risk_model_id, so risk forces
        // canonical anyway; emitting one shape everywhere removes a whole class of
        // round-trip ambiguity. Legacy documents remain readable on load.
        const objective_function = isAdvanced
            ? { schema_version: 2, mode: 'weighted', weighted: weightedObjectives.map((o) => buildCriterion(o, true)) }
            : { schema_version: 2, mode: 'lexicographic', lexicographic: lexicographicalObjectives.map((o) => buildCriterion(o, false)) };
        const payload = { objective_function };
        setSavingObjective(true);
        try {
            await authAxios.put(`http://localhost:5000/api/v1/problem_instances/${problemInstanceId}`, payload);
            enqueueSnackbar('Objective saved for this problem instance', { variant: 'success' });
        } catch (err) {
            enqueueSnackbar('Error saving objective', { variant: 'error' });
        } finally {
            setSavingObjective(false);
        }
    };

    if (!problemInstanceId) {
        return (
            <MainCard title="Objective Function">
                <Typography variant="body2" color="textSecondary">
                    Select a problem instance to define its objective function.
                </Typography>
            </MainCard>
        );
    }

    return (
        <MainCard
            title="Objective Function"
            secondary={
                <>
                    <Chip
                        sx={{
                            padding: '8px !important',
                            height: 'auto',
                            alignItems: 'center',
                            borderRadius: '27px',
                            transition: 'all .2s ease-in-out',
                            borderColor: theme.palette.primary.light,
                            backgroundColor: theme.palette.primary.light,
                            '&[aria-controls="menu-list-grow"], &:hover': {
                                cursor: 'default'
                            },
                            '& .MuiChip-label': {
                                lineHeight: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }
                        }}
                        icon={
                            <IconLifebuoy
                                stroke={1.5}
                                size="1.5rem"
                                color={theme.palette.primary.main}
                                sx={{
                                    margin: '8px 0 8px 8px !important'
                                }}
                            />
                        }
                        label={
                            <>
                                {selectedOFComparisonCollection && selectedOFComparisonCollection.hasOwnProperty('id') && (
                                    <Tooltip title={selectedOFComparisonCollection.description}>
                                        <Typography variant="h5" color={theme.palette.primary.main}>
                                            {selectedOFComparisonCollection.name} (#{selectedOFComparisonCollection.id})
                                        </Typography>
                                    </Tooltip>
                                )}
                                <Button onClick={handleOpenDialog} variant="text" sx={{ padding: 0 }}>
                                    <Typography variant="subtitle2" color={theme.palette.primary[800]} sx={{ textDecoration: 'underline' }}>
                                        {selectedOFComparisonCollection && selectedOFComparisonCollection.hasOwnProperty('id')
                                            ? 'Change Collection'
                                            : 'Select Collection'}
                                    </Typography>
                                </Button>
                            </>
                        }
                        variant="outlined"
                        color="primary"
                    />
                    <SelectOFComparisonCollectionDialog
                        isOpen={dialogOpen}
                        onClose={handleCloseDialog}
                        problemInstanceId={problemInstanceId}
                        onSelect={handleSelectOFComparisonCollection}
                    />
                    <FormControlLabel
                        control={<StyledSwitch checked={isAdvanced} onChange={handleToggleChange} />}
                        label={isAdvanced ? 'Advanced Mode' : 'Simple Mode'}
                        labelPlacement="start"
                    />
                    <Button variant="contained" size="small" onClick={handleSaveObjective} disabled={savingObjective || !problemInstanceId}>
                        {savingObjective ? <CircularProgress size={16} /> : 'Save Objective'}
                    </Button>
                </>
            }
        >
            <Grid container spacing={3}>
                {/* Inline Checkboxes for Common Objectives */}
                <Grid item xs={12}>
                    <FormControl component="fieldset">
                        <FormGroup row sx={{ justifyContent: 'center' }}>
                            {allObjectives.map((objective) => (
                                <Box
                                    sx={{
                                        display: 'inline-block', // Ensures the box wraps around the content
                                        borderWidth: objective.value == suggestedObjective ? '2px' : 0, // Border width
                                        borderStyle: 'solid', // Border style
                                        borderColor: theme.palette.secondary.main, // Border color
                                        borderRadius: '60px', // Rounded corners
                                        padding: '0px 12px', // Padding inside the box
                                        position: 'relative' // Position relative to place the "Suggested" text
                                    }}
                                >
                                    {/* "Suggested" Label */}
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: '-10px', // Position above the border
                                            left: '16px', // Slightly inside the left border
                                            backgroundColor: 'white', // Match the background color
                                            padding: '0 4px', // Padding around the "Suggested" text
                                            fontSize: '12px', // Font size for the "Suggested" text
                                            color: theme.palette.secondary.main, // Same color as the border
                                            fontWeight: 'bold', // Bold the text
                                            opacity: objective.value == suggestedObjective ? 1 : 0 // Hide the text by default
                                        }}
                                    >
                                        Suggested
                                    </Box>
                                    <FormControlLabel
                                        key={objective.value}
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={selectedObjectives.includes(objective.value)}
                                                onChange={handleCheckboxChange}
                                                value={objective.value}
                                                disabled={
                                                    !selectedObjectives.includes(objective.value) &&
                                                    selectedObjectives.length >= allObjectives.length
                                                }
                                                sx={{
                                                    color: theme.palette.secondary['200'],
                                                    '&.Mui-checked': {
                                                        color: theme.palette.secondary.main
                                                    }
                                                }}
                                            />
                                        }
                                        label={objective.label}
                                    />
                                </Box>
                            ))}
                        </FormGroup>
                    </FormControl>
                </Grid>

                {/* Explanation of Lexicographical Approach */}
                {!isAdvanced && (
                    <Grid item xs={12}>
                        <Typography variant="body1" textAlign="justify">
                            In the <strong>Simple Mode (Lexicographical Approach)</strong>, you can specify multiple objectives, which the
                            system will optimize in a defined <strong>order of importance</strong>. The first objective is prioritized the
                            highest, followed by the second, and so on. This means even a small improvement in the highest-priority
                            objective is valued over any improvement in the lesser ones. You can reorder these objectives using
                            drag-and-drop or arrow buttons. This approach, also known as <strong>preemptive optimization</strong>, ensures
                            that the most critical objectives are addressed first, providing a clear and structured prioritization that
                            aligns with your decision-making criteria.
                        </Typography>
                    </Grid>
                )}

                {/* Explanation of Advanced Mode */}
                {isAdvanced && (
                    <Grid item xs={12}>
                        <Typography variant="body1" textAlign="justify">
                            In the <strong>Advanced Mode (Weighted Sum Method)</strong>, you can define multiple objectives and assign a
                            <strong>weight</strong> to each objective to indicate its relative importance. The system optimizes these
                            objectives by combining them into a single composite function, where the weights determine how much influence
                            each objective has on the final result. By default, each new objective starts with a weight of
                            <strong>1</strong>, but you can adjust these weights to reflect their importance in the optimization process.
                            This method transforms a multi-objective problem into a single-objective problem, simplifying the optimization
                            task while allowing you to tailor the prioritization according to your preferences. The weighted sum approach
                            ensures that more critical objectives have a greater impact on the optimization outcome, providing a flexible
                            and structured way to balance competing objectives.
                        </Typography>
                    </Grid>
                )}

                {/* Simple Mode Inputs */}
                {!isAdvanced ? (
                    <Grid item xs={12}>
                        <Typography variant="h6">Simple Mode (Lexicographic)</Typography>
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="objectives">
                                {(provided) => (
                                    <List ref={provided.innerRef} {...provided.droppableProps}>
                                        {lexicographicalObjectives.map((objective, index) => {
                                            const objectiveLabel =
                                                allObjectives.find((obj) => obj.value === objective.value)?.label || objective.value;
                                            return (
                                                <Draggable key={objective.value} draggableId={objective.value} index={index}>
                                                    {(provided) => (
                                                        <ListItem
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            style={{
                                                                ...provided.draggableProps.style,
                                                                marginBottom: '8px',
                                                                padding: '16px',
                                                                background: '#f9f9f9',
                                                                borderRadius: '4px',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                            }}
                                                        >
                                                            <ListItemText
                                                                primary={
                                                                    <Grid container alignItems="center" spacing={2}>
                                                                        <Grid item>
                                                                            <IconGripVertical />
                                                                        </Grid>
                                                                        <Grid item>
                                                                            <Typography variant="h4">{index + 1}.</Typography>
                                                                        </Grid>
                                                                        <Grid item xs sx={{ paddingRight: '82px' }}>
                                                                            <Grid container justifyContent="center" textAlign="center">
                                                                                <Grid item xs={6} lg={3}>
                                                                                    <Select
                                                                                        fullWidth
                                                                                        value={objective.type}
                                                                                        onChange={(e) =>
                                                                                            handleTypeChange(
                                                                                                objective.value,
                                                                                                e.target.value
                                                                                            )
                                                                                        }
                                                                                        size="small"
                                                                                        sx={{
                                                                                            [`& fieldset`]: {
                                                                                                borderTopRightRadius: 0,
                                                                                                borderBottomRightRadius: 0
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <MenuItem value="min">Minimize</MenuItem>
                                                                                        <MenuItem value="max">Maximize</MenuItem>
                                                                                    </Select>
                                                                                </Grid>
                                                                                {objective.value === 'unserved_risk' && (
                                                                                    <Grid item xs={12} lg={4}>
                                                                                        <Select
                                                                                            fullWidth
                                                                                            displayEmpty
                                                                                            size="small"
                                                                                            error={!objective.riskModelId}
                                                                                            value={objective.riskModelId || ''}
                                                                                            onChange={(e) =>
                                                                                                handleRiskModelChange(
                                                                                                    objective.value,
                                                                                                    e.target.value || null
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            <MenuItem value="" disabled>
                                                                                                {riskModelOptions.length
                                                                                                    ? 'Select a risk model'
                                                                                                    : 'No READY risk model for this dataset instance'}
                                                                                            </MenuItem>
                                                                                            {riskModelOptions.map((m) => (
                                                                                                <MenuItem key={m.id} value={m.id}>
                                                                                                    {m.name}
                                                                                                    {m.enabled ? '' : ' (disabled)'}
                                                                                                </MenuItem>
                                                                                            ))}
                                                                                        </Select>
                                                                                    </Grid>
                                                                                )}
                                                                                <Grid item xs={6} lg={3}>
                                                                                    <TextField
                                                                                        fullWidth
                                                                                        value={objectiveLabel}
                                                                                        variant="outlined"
                                                                                        size="small"
                                                                                        sx={{
                                                                                            [`& fieldset`]: {
                                                                                                borderTopLeftRadius: 0,
                                                                                                borderBottomLeftRadius: 0
                                                                                            },
                                                                                            [`& input`]: {
                                                                                                WebkitTextFillColor: '#000!important',
                                                                                                textAlign: 'center'
                                                                                            }
                                                                                        }}
                                                                                        disabled
                                                                                    />
                                                                                </Grid>
                                                                            </Grid>
                                                                        </Grid>
                                                                    </Grid>
                                                                }
                                                            />
                                                            <ListItemSecondaryAction>
                                                                <IconButton
                                                                    edge="end"
                                                                    onClick={() => moveObjective(index, -1)}
                                                                    disabled={index === 0}
                                                                >
                                                                    <IconArrowUp />
                                                                </IconButton>
                                                                <IconButton
                                                                    edge="end"
                                                                    onClick={() => moveObjective(index, 1)}
                                                                    disabled={index === lexicographicalObjectives.length - 1}
                                                                >
                                                                    <IconArrowDown />
                                                                </IconButton>
                                                                <IconButton
                                                                    edge="end"
                                                                    onClick={() => handleRemoveObjective(objective.value)}
                                                                >
                                                                    <IconTrash />
                                                                </IconButton>
                                                            </ListItemSecondaryAction>
                                                        </ListItem>
                                                    )}
                                                </Draggable>
                                            );
                                        })}
                                        {provided.placeholder}
                                    </List>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </Grid>
                ) : (
                    <>
                        <Grid item xs={12}>
                            <Typography variant="h6">Advanced Definition</Typography>
                            <Grid container spacing={2}>
                                <Grid item xs sx={{ paddingRight: '82px' }}>
                                    <Grid container justifyContent="center" textAlign="center">
                                        <Grid item xs={6} lg={3}>
                                            <Typography variant="h6">Objective</Typography>
                                        </Grid>
                                        <Grid item xs={2} lg={1}>
                                            <Typography variant="h6">Weight</Typography>
                                        </Grid>
                                    </Grid>
                                </Grid>
                            </Grid>
                            <List>
                                {objectivesLabels.map(
                                    (objective) =>
                                        selectedObjectives.includes(objective.value) && (
                                            <ListItem
                                                key={objective.value}
                                                style={{
                                                    marginBottom: '8px',
                                                    padding: '16px',
                                                    background: '#f9f9f9',
                                                    borderRadius: '4px',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                <ListItemText
                                                    primary={
                                                        <Grid container alignItems="center" spacing={2}>
                                                            <Grid item xs sx={{ paddingRight: '82px' }}>
                                                                <Grid container justifyContent="center" textAlign="center">
                                                                    <Grid item xs={6} lg={3}>
                                                                        <TextField
                                                                            fullWidth
                                                                            value={objective.label}
                                                                            variant="outlined"
                                                                            disabled
                                                                            size="small"
                                                                            sx={{
                                                                                [`& fieldset`]: {
                                                                                    borderTopRightRadius: 0,
                                                                                    borderBottomRightRadius: 0
                                                                                },
                                                                                [`& input`]: {
                                                                                    WebkitTextFillColor: '#000!important',
                                                                                    textAlign: 'center'
                                                                                }
                                                                            }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={2} lg={1}>
                                                                        <TextField
                                                                            fullWidth
                                                                            type="number"
                                                                            variant="outlined"
                                                                            size="small"
                                                                            value={weights[objective.value] || 0}
                                                                            onChange={(e) =>
                                                                                handleWeightChange(
                                                                                    objective.value,
                                                                                    parseFloat(e.target.value) || 0
                                                                                )
                                                                            }
                                                                            sx={{
                                                                                [`& fieldset`]: {
                                                                                    borderTopLeftRadius: 0,
                                                                                    borderBottomLeftRadius: 0
                                                                                },
                                                                                [`& input`]: { textAlign: 'center' }
                                                                            }}
                                                                        />
                                                                    </Grid>
                                                                </Grid>
                                                            </Grid>
                                                        </Grid>
                                                    }
                                                />
                                                <ListItemSecondaryAction>
                                                    <IconButton edge="end" onClick={() => handleRemoveObjective(objective.value)}>
                                                        <IconTrash />
                                                    </IconButton>
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                        )
                                )}
                            </List>
                        </Grid>
                    </>
                )}

                {/* Import Functionality */}
                <Grid item xs={3}>
                    <Button variant="outlined" color="primary">
                        Import Objective Function
                    </Button>
                </Grid>
                <Grid item xs={3}>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AutoFixHigh />}
                        onClick={automaticOFDefinition}
                        disabled={!selectedOFComparisonCollection}
                    >
                        Automatic
                    </Button>
                    {!selectedOFComparisonCollection && (
                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            Start by selecting a Collection
                        </Typography>
                    )}
                </Grid>
            </Grid>
        </MainCard>
    );
};

export default ObjectiveFunctionEditor;
