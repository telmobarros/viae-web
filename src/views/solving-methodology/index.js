import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Grid,
    Typography,
    Button,
    TextField,
    Select,
    MenuItem,
    CircularProgress,
    Paper,
    FormControlLabel,
    Snackbar,
    Alert,
    Slider,
    Box,
    Input as MuiInput,
    Switch,
    Tooltip,
    IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Autocomplete from '@mui/material/Autocomplete';
import { styled } from '@mui/material/styles';
import authAxios from 'utils/axios';
import MainCard from 'ui-component/cards/MainCard';
import SubCard from 'ui-component/cards/SubCard';

const Input = styled(MuiInput)`
    width: 42px;
`;

const OBJECTIVE_STORAGE_KEY = 'objectiveDefinition';

const SolverConfigurationPage = () => {
    const [solverConfig, setSolverConfig] = useState({
        useClustering: false,
        clusteringParams: { strategy: '', clusters: 0 },
        orchestration: { mode: 'sequential', handoff: true, topK: 1 },
        // Reproducibility (UI-only)
        seed: '',
        autoNormalize: true,
        engine: 'python',
        // Initialization
        initialSolution: 'random',
        mainMethodology: '',
        mainHyperparameters: {},
        // Termination Criteria (Main)
        mainTermination: { maxIterations: 1000, timeLimitSec: 0, noImproveIters: 0 },
        mainSearchOperators: {
            intraRoute: {
                'Adjacent Swap': { active: false, probability: 0 },
                'General Swap': { active: false, probability: 0 },
                'Single Insertion': { active: false, probability: 0 },
                'Block Insertion': { active: false, probability: 0 },
                '2-Opt': { active: false, probability: 0 },
                'Or-Opt(1)': { active: false, probability: 0 },
                'Or-Opt(2)': { active: false, probability: 0 },
                'Or-Opt(3)': { active: false, probability: 0 },
                '3-Opt': { active: false, probability: 0 },
                'Double-Bridge Kick': { active: false, probability: 0 },
                'Granular 2-Opt': { active: false, probability: 0 }
            },
            interRoute: {
                'Shift(n,m)': { active: false, probability: 0 },
                'Swap(n,m)': { active: false, probability: 0 },
                '2-Opt*': { active: false, probability: 0 },
                'Cross-Exchange': { active: false, probability: 0 },
                'Lambda Interchange': { active: false, probability: 0 },
                'Ejection Chains': { active: false, probability: 0 },
                'Route-Exchange': { active: false, probability: 0 }
            },
            destroy: {
                'Random Removal': { active: false, probability: 0 },
                'Worst Removal': { active: false, probability: 0 },
                'Route Removal': { active: false, probability: 0 },
                'Shaw Removal': { active: false, probability: 0 }
            },
            repair: {
                'Greedy Insertion': { active: false, probability: 0 },
                'Regret-2 Insertion': { active: false, probability: 0 },
                'Regret-3 Insertion': { active: false, probability: 0 },
                'Noise Insertion': { active: false, probability: 0 }
            }
        },
        useSecondaryMethodology: false,
        secondaryMethodology: '',
        secondaryHyperparameters: {},
        // Termination Criteria (Secondary)
        secondaryTermination: { maxIterations: 500, timeLimitSec: 0, noImproveIters: 0 },
        // Secondary stage will use global reproducibility; only budget kept here
        secondarySearchOperators: {
            intraRoute: {
                'Adjacent Swap': { active: false, probability: 0 },
                'General Swap': { active: false, probability: 0 },
                'Single Insertion': { active: false, probability: 0 },
                'Block Insertion': { active: false, probability: 0 },
                '2-Opt': { active: false, probability: 0 },
                'Or-Opt(1)': { active: false, probability: 0 },
                'Or-Opt(2)': { active: false, probability: 0 },
                'Or-Opt(3)': { active: false, probability: 0 },
                '3-Opt': { active: false, probability: 0 },
                'Double-Bridge Kick': { active: false, probability: 0 },
                'Granular 2-Opt': { active: false, probability: 0 }
            },
            interRoute: {
                'Shift(n,m)': { active: false, probability: 0 },
                'Swap(n,m)': { active: false, probability: 0 },
                '2-Opt*': { active: false, probability: 0 },
                'Cross-Exchange': { active: false, probability: 0 },
                'Lambda Interchange': { active: false, probability: 0 },
                'Ejection Chains': { active: false, probability: 0 },
                'Route-Exchange': { active: false, probability: 0 }
            },
            destroy: {
                'Random Removal': { active: false, probability: 0 },
                'Worst Removal': { active: false, probability: 0 },
                'Route Removal': { active: false, probability: 0 },
                'Shaw Removal': { active: false, probability: 0 }
            },
            repair: {
                'Greedy Insertion': { active: false, probability: 0 },
                'Regret-2 Insertion': { active: false, probability: 0 },
                'Regret-3 Insertion': { active: false, probability: 0 },
                'Noise Insertion': { active: false, probability: 0 }
            }
        },
        // Global penalties and advanced options
        penalties: { tw: 1, capacity: 1, duration: 0, adaptive: false },
        granularGamma: 0
    });

    const instance = useSelector((state) => state.instance.instance);
    const [problemInstances, setProblemInstances] = useState([]);
    const [problemInstanceId, setProblemInstanceId] = useState(0);

    const [loading, setLoading] = useState(false);
    const [executionStatus, setExecutionStatus] = useState(null);
    const [error, setError] = useState(null);

    // Backend-stored configurations (presets + previous runs)
    const [configurations, setConfigurations] = useState([]);
    const [presetName, setPresetName] = useState('');

    const methodologies = [
        { name: 'Hill Climbing', params: { 'Step Size': 1, 'Max Moves/Iter': 100, 'Accept Ties (0/1)': 1 } },
        { name: 'Iterated Local Search', params: { 'Perturbation Strength': 2, 'Restart After No-Improve': 500 } },
        { name: 'VNS/VND', params: { 'Max Shakes/Level': 10, 'Initial Shake Strength': 1 } },
        { name: 'Simulated Annealing', params: { 'Initial Temperature': 100, 'Cooling Rate': 0.95, 'Chain Length': 50 } },
        { name: 'Tabu Search', params: { 'Tabu Tenure': 15, 'Aspiration Delta': 0 } },
        {
            name: 'ALNS',
            params: {
                'Reaction Factor': 0.2,
                'Segment Length': 100,
                'Score Improve': 10,
                'Score Accept': 5,
                'Score Reject': 1,
                'Removal pmin (%)': 10,
                'Removal pmax (%)': 40
            }
        },
        {
            name: 'Genetic Algorithm',
            params: {
                'Population Size': 50,
                Elites: 2,
                'Crossover Rate': 0.9,
                'Mutation Rate': 0.1,
                'Tournament Size': 3,
                'LS Depth (0/1)': 1
            }
        }
    ];

    const searchOperators = {
        intraRoute: {
            'Adjacent Swap': { active: false, probability: 0 },
            'General Swap': { active: false, probability: 0 },
            'Single Insertion': { active: false, probability: 0 },
            'Block Insertion': { active: false, probability: 0 },
            '2-Opt': { active: false, probability: 0 },
            'Or-Opt(1)': { active: false, probability: 0 },
            'Or-Opt(2)': { active: false, probability: 0 },
            'Or-Opt(3)': { active: false, probability: 0 },
            '3-Opt': { active: false, probability: 0 },
            'Double-Bridge Kick': { active: false, probability: 0 },
            'Granular 2-Opt': { active: false, probability: 0 }
        },
        interRoute: {
            'Shift(n,m)': { active: false, probability: 0 },
            'Swap(n,m)': { active: false, probability: 0 },
            '2-Opt*': { active: false, probability: 0 },
            'Cross-Exchange': { active: false, probability: 0 },
            'Lambda Interchange': { active: false, probability: 0 },
            'Ejection Chains': { active: false, probability: 0 },
            'Route-Exchange': { active: false, probability: 0 }
        },
        destroy: {
            'Random Removal': { active: false, probability: 0 },
            'Worst Removal': { active: false, probability: 0 },
            'Route Removal': { active: false, probability: 0 },
            'Shaw Removal': { active: false, probability: 0 }
        },
        repair: {
            'Greedy Insertion': { active: false, probability: 0 },
            'Regret-2 Insertion': { active: false, probability: 0 },
            'Regret-3 Insertion': { active: false, probability: 0 },
            'Noise Insertion': { active: false, probability: 0 }
        }
    };

    const clusteringStrategies = ['K-Means', 'K-Medoids', 'DBSCAN'];
    const initializationMethods = [
        { value: 'random', label: 'Random' },
        { value: 'greedy_nn', label: 'Greedy (Nearest Neighbor)' },
        { value: 'savings', label: 'Savings' }
    ];

    const getObjectiveDefinition = () => {
        try {
            const raw = localStorage.getItem(OBJECTIVE_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    };

    useEffect(() => {
        if (!instance) return;
        authAxios
            .get(`http://localhost:5000/api/v1/dataset_instances/${instance.id}`)
            .then((apiResponse) => {
                console.log(apiResponse.data);
                setProblemInstances(apiResponse.data.result.problem_instances);
                if (apiResponse.data.result.problem_instances.length > 0)
                    setProblemInstanceId(apiResponse.data.result.problem_instances[0].id);
            })
            .catch((error) => {
                console.log(error);
            });
    }, [instance]);

    // Set default main methodology on mount if empty
    useEffect(() => {
        if (!solverConfig.mainMethodology) {
            const selected = methodologies.find((m) => m.name === DEFAULT_MAIN_METHODOLOGY) || methodologies[0];
            if (selected) {
                setSolverConfig((prev) => ({
                    ...prev,
                    mainMethodology: selected.name,
                    mainHyperparameters: selected.params || {},
                    mainSearchOperators: searchOperators
                }));
            }
        }
    }, []);

    // Load previously used configurations / presets from the backend
    useEffect(() => {
        const fetchConfigurations = async () => {
            try {
                const response = await authAxios.get('http://localhost:5000/api/v1/solver/configurations', {
                    params: { limit: 50 }
                });
                setConfigurations(response.data.result || []);
            } catch (err) {
                // Non-fatal for the page; just log
                // eslint-disable-next-line no-console
                console.error(err);
            }
        };
        fetchConfigurations();
    }, []);

    const DEFAULT_MAIN_METHODOLOGY = 'VNS/VND';
    const DEFAULT_SECONDARY_METHODOLOGY = 'ALNS';

    const handleConfigChange = (key, value) => {
        setSolverConfig((prev) => {
            // Derive orchestration mode from secondary methodology toggle
            if (key === 'useSecondaryMethodology') {
                const nextOrchestration = {
                    ...prev.orchestration,
                    mode: value ? 'sequential' : 'none',
                    // Always hand off best solution from main to secondary when secondary is enabled
                    handoff: value ? true : prev.orchestration.handoff
                };
                const baseNext = {
                    ...prev,
                    useSecondaryMethodology: value,
                    orchestration: nextOrchestration
                };
                if (value && !prev.secondaryMethodology) {
                    const selected = methodologies.find((m) => m.name === DEFAULT_SECONDARY_METHODOLOGY) || methodologies[0];
                    return {
                        ...baseNext,
                        secondaryMethodology: selected?.name || prev.secondaryMethodology,
                        secondaryHyperparameters: selected?.params || {},
                        secondarySearchOperators: searchOperators
                    };
                }
                return baseNext;
            }

            return {
                ...prev,
                [key]: value
            };
        });
    };

    const applyConfigurationFromBackend = (config) => {
        if (!config) return;
        setSolverConfig((prev) => ({
            ...prev,
            useClustering: typeof config.useClustering === 'boolean' ? config.useClustering : prev.useClustering,
            clusteringParams: config.clusteringParams || prev.clusteringParams,
            initialSolution: config.initialSolution || prev.initialSolution,
            mainMethodology: config.mainMethodology || prev.mainMethodology,
            mainHyperparameters: config.mainHyperparameters || prev.mainHyperparameters,
            mainSearchOperators: config.mainSearchOperators || prev.mainSearchOperators,
            useSecondaryMethodology:
                typeof config.useSecondaryMethodology === 'boolean' ? config.useSecondaryMethodology : prev.useSecondaryMethodology,
            secondaryMethodology: config.secondaryMethodology || prev.secondaryMethodology,
            secondaryHyperparameters: config.secondaryHyperparameters || prev.secondaryHyperparameters,
            secondarySearchOperators: config.secondarySearchOperators || prev.secondarySearchOperators,
            // Reproducibility
            seed: config.seed !== null && config.seed !== undefined ? String(config.seed) : prev.seed,
            // Orchestration (mode is derived from useSecondaryMethodology in handleConfigChange)
            orchestration: {
                ...prev.orchestration,
                handoff:
                    config.orchestration && Object.prototype.hasOwnProperty.call(config.orchestration, 'handoff')
                        ? !!config.orchestration.handoff
                        : prev.orchestration.handoff,
                topK:
                    config.orchestration && Object.prototype.hasOwnProperty.call(config.orchestration, 'topK')
                        ? config.orchestration.topK
                        : prev.orchestration.topK
            },
            // Termination criteria
            mainTermination: config.mainTermination || prev.mainTermination,
            secondaryTermination: config.secondaryTermination || prev.secondaryTermination,
            // Global penalties & advanced options stored inside mainHyperparameters on backend
            penalties:
                config.mainHyperparameters && config.mainHyperparameters.penalties ? config.mainHyperparameters.penalties : prev.penalties,
            granularGamma:
                config.mainHyperparameters && Object.prototype.hasOwnProperty.call(config.mainHyperparameters, 'granularGamma')
                    ? config.mainHyperparameters.granularGamma
                    : prev.granularGamma
        }));
    };

    const handleClusteringChange = (param, value) => {
        setSolverConfig((prev) => ({
            ...prev,
            clusteringParams: { ...prev.clusteringParams, [param]: value }
        }));
    };

    const handleSliderChange = (category, operator, value, isSecondary = false) => {
        setSolverConfig((prev) => {
            const updatedOperators = isSecondary ? { ...prev.secondarySearchOperators } : { ...prev.mainSearchOperators };
            updatedOperators[category][operator].probability = value;
            return isSecondary
                ? { ...prev, secondarySearchOperators: updatedOperators }
                : { ...prev, mainSearchOperators: updatedOperators };
        });
        if (solverConfig.autoNormalize) adjustProbabilities(category, operator, isSecondary);
    };

    const handleInputChange = (category, operator, event, isSecondary = false) => {
        const value = event.target.value === '' ? 0 : Number(event.target.value);
        handleSliderChange(category, operator, value, isSecondary);
    };

    const handleRemoveOperator = (category, operator, isSecondary = false) => {
        setSolverConfig((prev) => {
            const updatedOperators = isSecondary ? { ...prev.secondarySearchOperators } : { ...prev.mainSearchOperators };
            if (updatedOperators[category] && updatedOperators[category][operator]) {
                updatedOperators[category][operator].active = false;
                updatedOperators[category][operator].probability = 0;
            }
            return isSecondary
                ? { ...prev, secondarySearchOperators: updatedOperators }
                : { ...prev, mainSearchOperators: updatedOperators };
        });
    };

    const handleAddOperator = (category, operator, isSecondary = false) => {
        if (!operator) return;
        setSolverConfig((prev) => {
            const updatedOperators = isSecondary ? { ...prev.secondarySearchOperators } : { ...prev.mainSearchOperators };
            if (updatedOperators[category] && updatedOperators[category][operator]) {
                updatedOperators[category][operator] = { active: true, probability: 1 };
            }
            return isSecondary
                ? { ...prev, secondarySearchOperators: updatedOperators }
                : { ...prev, mainSearchOperators: updatedOperators };
        });
    };

    const calculateTotalProbability = (isSecondary = false) => {
        const updatedOperators = isSecondary ? solverConfig.secondarySearchOperators : solverConfig.mainSearchOperators;
        let total = 0;
        ['intraRoute', 'interRoute', 'destroy', 'repair'].forEach((cat) => {
            if (updatedOperators[cat]) {
                total += Object.values(updatedOperators[cat]).reduce((sum, op) => sum + (op.active ? op.probability : 0), 0);
            }
        });
        return total;
    };

    const calculateGlobalTotal = (ops) => {
        const intra = Object.values(ops.intraRoute).reduce((s, op) => s + (op.active ? op.probability : 0), 0);
        const inter = Object.values(ops.interRoute).reduce((s, op) => s + (op.active ? op.probability : 0), 0);
        return intra + inter;
    };

    const adjustProbabilities = (category, operator, isSecondary = false) => {
        // category and operator are the ones that should be mantained
        const total = calculateTotalProbability(isSecondary);
        console.log(JSON.stringify(solverConfig));
        console.log('Total:', total);
        if (total > 100) {
            setSolverConfig((prev) => {
                const updatedOperators = isSecondary ? { ...prev.secondarySearchOperators } : { ...prev.mainSearchOperators };
                const factor =
                    (100 - updatedOperators[category][operator].probability) / (total - updatedOperators[category][operator].probability);
                console.log('Factor:', factor);
                ['intraRoute', 'interRoute', 'destroy', 'repair'].forEach((cat) => {
                    if (!updatedOperators[cat]) return;
                    Object.keys(updatedOperators[cat]).forEach((key) => {
                        if (updatedOperators[cat][key].active && (category !== cat || operator !== key)) {
                            updatedOperators[cat][key].probability = Math.floor(updatedOperators[cat][key].probability * factor);
                        }
                    });
                });
                return isSecondary
                    ? { ...prev, secondarySearchOperators: updatedOperators }
                    : { ...prev, mainSearchOperators: updatedOperators };
            });
        }
    };

    const handleMethodologyChange = (key, value, isMain = true) => {
        const selectedMethodology = methodologies.find((m) => m.name === value);
        if (isMain) {
            setSolverConfig((prev) => ({
                ...prev,
                mainMethodology: value,
                mainHyperparameters: selectedMethodology.params || {},
                mainSearchOperators: searchOperators
            }));
        } else {
            setSolverConfig((prev) => ({
                ...prev,
                secondaryMethodology: value,
                secondaryHyperparameters: selectedMethodology.params || {},
                secondarySearchOperators: searchOperators
            }));
        }
    };

    const renderSearchOperators = (operators, category, isSecondary = false) => {
        const ops = isSecondary ? solverConfig.secondarySearchOperators : solverConfig.mainSearchOperators;
        const globalTotal = calculateGlobalTotal(ops) || 1; // avoid div by zero
        const availableOptions = Object.keys(operators).filter((op) => !ops[category][op].active);
        const activeKeys = Object.keys(operators).filter((op) => ops[category][op].active);
        return (
            <>
                <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom textAlign={'center'}>
                        {category === 'intraRoute'
                            ? 'Intra Route Operators'
                            : category === 'interRoute'
                              ? 'Inter Route Operators'
                              : category === 'destroy'
                                ? 'Destroy Operators'
                                : 'Repair Operators'}
                    </Typography>
                </Grid>
                <Grid item xs={12}>
                    <Autocomplete
                        size="small"
                        options={availableOptions}
                        value={null}
                        onChange={(e, value) => handleAddOperator(category, value, isSecondary)}
                        renderInput={(params) => <TextField {...params} label="Add operator" placeholder="Type to search..." />}
                        clearOnBlur
                        clearOnEscape
                        disableListWrap
                    />
                </Grid>
                {activeKeys.map((operator) => (
                    <Grid item xs={12} key={operator} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Grid container spacing={3}>
                            <Grid item xs={3} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography>{operator}</Typography>
                                <Tooltip title="Remove operator">
                                    <IconButton
                                        size="small"
                                        aria-label={`remove-${operator}`}
                                        onClick={() => handleRemoveOperator(category, operator, isSecondary)}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Grid>
                            <Grid item xs={6}>
                                <Slider
                                    value={operators[operator].probability}
                                    onChange={(e, value) => handleSliderChange(category, operator, value, isSecondary)}
                                    //onChangeCommitted={() => adjustProbabilities(isSecondary)}
                                    disabled={!operators[operator].active}
                                    step={1}
                                    min={0}
                                    max={100}
                                    valueLabelDisplay="on"
                                    valueLabelFormat={(v) => {
                                        const share = operators[operator].active ? Math.round((v / globalTotal) * 100) : 0;
                                        return `${v} w | ${share}%`;
                                    }}
                                    sx={{ flexGrow: 1, mx: 2 }}
                                    aria-labelledby={`${operator}-slider`}
                                />
                            </Grid>
                            <Grid item xs={2} justifyContent={'space-between'}>
                                <Input
                                    value={operators[operator].probability}
                                    size="small"
                                    onChange={(e) => handleInputChange(category, operator, e, isSecondary)}
                                    //onChangeCommitted={() => adjustProbabilities(isSecondary)}
                                    disabled={!operators[operator].active}
                                    inputProps={{
                                        step: 1,
                                        min: 0,
                                        max: 100,
                                        type: 'number',
                                        'aria-labelledby': `${operator}-slider`
                                    }}
                                />
                            </Grid>
                            <Grid item xs={1}>
                                <Typography variant="caption" color="textSecondary">
                                    Share:{' '}
                                    {operators[operator].active ? Math.round((operators[operator].probability / globalTotal) * 100) : 0}%
                                </Typography>
                            </Grid>
                        </Grid>
                    </Grid>
                ))}
            </>
        );
    };

    const getAllowedCategories = (methodName) => {
        switch (methodName) {
            case 'ALNS':
                return ['destroy', 'repair'];
            case 'Genetic Algorithm':
            case 'VNS/VND':
            case 'Tabu Search':
            case 'Simulated Annealing':
            case 'Iterated Local Search':
            case 'Hill Climbing':
                return ['intraRoute', 'interRoute'];
            default:
                return ['intraRoute', 'interRoute', 'destroy', 'repair'];
        }
    };

    const normalizeOperatorSet = (ops) => {
        const clone = JSON.parse(JSON.stringify(ops));
        const total = calculateGlobalTotal(clone);
        if (total <= 0) return clone;
        const scale = 100 / total;
        ['intraRoute', 'interRoute'].forEach((cat) => {
            Object.keys(clone[cat]).forEach((k) => {
                if (clone[cat][k].active) {
                    clone[cat][k].probability = Math.round(clone[cat][k].probability * scale);
                } else {
                    clone[cat][k].probability = 0;
                }
            });
        });
        return clone;
    };

    const savePreset = async () => {
        if (!presetName) return;
        setLoading(true);
        setError(null);
        try {
            const mainSearchOperators = normalizeOperatorSet(solverConfig.mainSearchOperators);
            const secondarySearchOperators = solverConfig.useSecondaryMethodology
                ? normalizeOperatorSet(solverConfig.secondarySearchOperators)
                : undefined;
            const mainHyperparameters = {
                ...solverConfig.mainHyperparameters
            };

            const configuration = {
                useClustering: solverConfig.useClustering,
                clusteringParams: solverConfig.clusteringParams,
                initialSolution: solverConfig.initialSolution,
                mainMethodology: solverConfig.mainMethodology,
                engine: solverConfig.engine,
                mainHyperparameters,
                mainSearchOperators,
                useSecondaryMethodology: solverConfig.useSecondaryMethodology,
                ...(solverConfig.useSecondaryMethodology
                    ? {
                          secondaryMethodology: solverConfig.secondaryMethodology,
                          secondaryHyperparameters: solverConfig.secondaryHyperparameters,
                          secondarySearchOperators
                      }
                    : {}),
                // Global advanced
                penalties: solverConfig.penalties,
                granularGamma: solverConfig.granularGamma,
                // Reproducibility
                seed: solverConfig.seed === '' ? null : Number(solverConfig.seed),
                // Orchestration (derived mode from secondary toggle)
                orchestration: {
                    mode: solverConfig.useSecondaryMethodology ? 'sequential' : 'none',
                    // always hand off the main best solution when secondary is enabled
                    handoff: !!solverConfig.useSecondaryMethodology,
                    topK: parseInt(solverConfig.orchestration.topK, 10) || 1
                },
                // Termination Criteria
                mainTermination: solverConfig.mainTermination,
                secondaryTermination: solverConfig.useSecondaryMethodology ? solverConfig.secondaryTermination : undefined,
                // Optional label fields
                name: presetName
            };

            const response = await authAxios.post('http://localhost:5000/api/v1/solver/presets', {
                name: presetName,
                configuration
            });

            if (response.data && response.data.configuration) {
                setConfigurations((prev) => [response.data.configuration, ...prev]);
            }
            setPresetName('');
            setExecutionStatus('Preset saved successfully');
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            setError('Error saving preset. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const launchResolution = async () => {
        setLoading(true);
        setError(null);
        try {
            // Build payload with only backend-relevant fields
            const mainSearchOperators = normalizeOperatorSet(solverConfig.mainSearchOperators);
            const secondarySearchOperators = solverConfig.useSecondaryMethodology
                ? normalizeOperatorSet(solverConfig.secondarySearchOperators)
                : undefined;
            const mainHyperparameters = {
                ...solverConfig.mainHyperparameters
            };

            const configuration = {
                useClustering: solverConfig.useClustering,
                clusteringParams: solverConfig.clusteringParams,
                initialSolution: solverConfig.initialSolution,
                mainMethodology: solverConfig.mainMethodology,
                engine: solverConfig.engine,
                mainHyperparameters,
                mainSearchOperators,
                useSecondaryMethodology: solverConfig.useSecondaryMethodology,
                ...(solverConfig.useSecondaryMethodology
                    ? {
                          secondaryMethodology: solverConfig.secondaryMethodology,
                          secondaryHyperparameters: solverConfig.secondaryHyperparameters,
                          secondarySearchOperators
                      }
                    : {}),
                // Global advanced
                penalties: solverConfig.penalties,
                granularGamma: solverConfig.granularGamma,
                // Reproducibility
                seed: solverConfig.seed === '' ? null : Number(solverConfig.seed),
                // Orchestration (derived mode from secondary toggle)
                orchestration: {
                    mode: solverConfig.useSecondaryMethodology ? 'sequential' : 'none',
                    // always hand off the main best solution when secondary is enabled
                    handoff: !!solverConfig.useSecondaryMethodology,
                    topK: parseInt(solverConfig.orchestration.topK) || 1
                },
                // Termination Criteria
                mainTermination: solverConfig.mainTermination,
                secondaryTermination: solverConfig.useSecondaryMethodology ? solverConfig.secondaryTermination : undefined
            };

            const response = await authAxios.post('http://localhost:5000/api/v1/solver/launch', {
                configuration,
                problem_instance_id: problemInstanceId
            });
            setExecutionStatus(response.data.status);
        } catch (error) {
            setError('Error launching resolution. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainCard
            title="Solver Configuration"
            secondary={
                <TextField
                    id="select-problem"
                    select
                    value={problemInstanceId}
                    onChange={(e) => {
                        setProblemInstanceId(e.target.value);
                    }}
                    size="small"
                >
                    {problemInstances.map((option) => (
                        <MenuItem key={option.id} value={option.id}>
                            <Tooltip title={option.description}>{option.name}</Tooltip>
                        </MenuItem>
                    ))}
                </TextField>
            }
        >
            <Grid container spacing={3}>
                {/* Presets / Previously used configurations */}
                <Grid item xs={12}>
                    <SubCard title="Configuration Presets">
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="caption">Load from previous configurations</Typography>
                                <Autocomplete
                                    size="small"
                                    options={configurations}
                                    getOptionLabel={(option) =>
                                        option && option.name
                                            ? `${option.name}${option.mainMethodology ? ` (${option.mainMethodology})` : ''}`
                                            : option && option.id
                                              ? `Configuration #${option.id}`
                                              : ''
                                    }
                                    onChange={(e, value) => applyConfigurationFromBackend(value)}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Select configuration" placeholder="Type to search by name..." />
                                    )}
                                    clearOnBlur
                                    clearOnEscape
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="caption">Save current configuration as preset</Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <TextField
                                        label="Preset name"
                                        size="small"
                                        fullWidth
                                        value={presetName}
                                        onChange={(e) => setPresetName(e.target.value)}
                                    />
                                    <Button variant="outlined" onClick={savePreset} disabled={!presetName || loading}>
                                        Save
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                    </SubCard>
                </Grid>
                {/* Initialization */}
                <Grid item xs={12}>
                    <SubCard title="Initialization">
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="caption">Initial Solution</Typography>
                                <Select
                                    value={solverConfig.initialSolution}
                                    onChange={(e) => handleConfigChange('initialSolution', e.target.value)}
                                    fullWidth
                                >
                                    {initializationMethods.map((m) => (
                                        <MenuItem key={m.value} value={m.value}>
                                            {m.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="caption">Compute Engine</Typography>
                                <Select
                                    value={solverConfig.engine}
                                    onChange={(e) => handleConfigChange('engine', e.target.value)}
                                    fullWidth
                                >
                                    <MenuItem value="python">Python</MenuItem>
                                    <MenuItem value="cpp">C++ (if available)</MenuItem>
                                </Select>
                            </Grid>
                        </Grid>
                    </SubCard>
                </Grid>
                {/* Orchestration */}
                <Grid item xs={12}>
                    <SubCard title="Orchestration">
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                                <Typography variant="caption">Mode</Typography>
                                <Select value={solverConfig.useSecondaryMethodology ? 'sequential' : 'none'} disabled fullWidth>
                                    <MenuItem value={'sequential'}>Sequential (Main → Secondary)</MenuItem>
                                    <MenuItem value={'none'}>None (Single Stage)</MenuItem>
                                </Select>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="Top-K (optional)"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    value={solverConfig.orchestration.topK}
                                    onChange={(e) =>
                                        handleConfigChange('orchestration', {
                                            ...solverConfig.orchestration,
                                            topK: parseInt(e.target.value) || 1
                                        })
                                    }
                                />
                            </Grid>
                        </Grid>
                    </SubCard>
                </Grid>

                {/* Penalties & Advanced */}
                <Grid item xs={12}>
                    <SubCard title="Penalties & Advanced">
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="TW Penalty"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    value={solverConfig.penalties.tw}
                                    onChange={(e) =>
                                        handleConfigChange('penalties', { ...solverConfig.penalties, tw: parseFloat(e.target.value) || 0 })
                                    }
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="Capacity Penalty"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    value={solverConfig.penalties.capacity}
                                    onChange={(e) =>
                                        handleConfigChange('penalties', {
                                            ...solverConfig.penalties,
                                            capacity: parseFloat(e.target.value) || 0
                                        })
                                    }
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="Duration Penalty"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    value={solverConfig.penalties.duration}
                                    onChange={(e) =>
                                        handleConfigChange('penalties', {
                                            ...solverConfig.penalties,
                                            duration: parseFloat(e.target.value) || 0
                                        })
                                    }
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={solverConfig.penalties.adaptive}
                                            onChange={(e) =>
                                                handleConfigChange('penalties', { ...solverConfig.penalties, adaptive: e.target.checked })
                                            }
                                        />
                                    }
                                    label="Adaptive Penalties"
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="Granular Threshold (?)"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    value={solverConfig.granularGamma}
                                    onChange={(e) => handleConfigChange('granularGamma', parseFloat(e.target.value) || 0)}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={solverConfig.reproducible}
                                            onChange={(e) => handleConfigChange('reproducible', e.target.checked)}
                                        />
                                    }
                                    label="Reproducible"
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="Seed"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    disabled={!solverConfig.reproducible}
                                    value={solverConfig.seed}
                                    onChange={(e) => handleConfigChange('seed', e.target.value)}
                                />
                            </Grid>

                            <Grid item xs={12} md={3}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={solverConfig.autoNormalize}
                                            onChange={(e) => handleConfigChange('autoNormalize', e.target.checked)}
                                        />
                                    }
                                    label="Auto-normalize Weights"
                                />
                            </Grid>
                        </Grid>
                    </SubCard>
                </Grid>
                {/* Clustering Step */}
                <Grid item xs={12}>
                    <SubCard
                        title="Clustering"
                        content={solverConfig.useClustering}
                        secondary={
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={solverConfig.useClustering}
                                        onChange={(e) => handleConfigChange('useClustering', e.target.checked)}
                                    />
                                }
                                label="Clustering"
                            />
                        }
                    >
                        {solverConfig.useClustering && (
                            <Grid container spacing={3}>
                                <Grid item xs={6}>
                                    <Select
                                        value={solverConfig.clusteringParams.strategy}
                                        onChange={(e) => handleClusteringChange('strategy', e.target.value)}
                                        fullWidth
                                    >
                                        {clusteringStrategies.map((strategy) => (
                                            <MenuItem key={strategy} value={strategy}>
                                                {strategy}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="Number of Clusters"
                                        type="number"
                                        fullWidth
                                        onChange={(e) => handleClusteringChange('clusters', parseInt(e.target.value) || 0)}
                                    />
                                </Grid>
                            </Grid>
                        )}
                    </SubCard>
                </Grid>

                {/* Main Methodology */}
                <Grid item xs={12}>
                    <SubCard title="Main Methodology">
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Select
                                    value={solverConfig.mainMethodology}
                                    onChange={(e) => handleMethodologyChange('mainMethodology', e.target.value)}
                                    fullWidth
                                >
                                    {methodologies.map((m) => (
                                        <MenuItem key={m.name} value={m.name}>
                                            {m.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </Grid>
                            {/* Termination Criteria (Main) */}
                            <Grid item xs={12}>
                                <SubCard title="Termination Criteria">
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={4}>
                                            <TextField
                                                label="Max Iterations"
                                                type="number"
                                                size="small"
                                                fullWidth
                                                value={solverConfig.mainTermination.maxIterations}
                                                onChange={(e) =>
                                                    handleConfigChange('mainTermination', {
                                                        ...solverConfig.mainTermination,
                                                        maxIterations: parseInt(e.target.value) || 0
                                                    })
                                                }
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={4}>
                                            <TextField
                                                label="Time Limit (sec)"
                                                type="number"
                                                size="small"
                                                fullWidth
                                                value={solverConfig.mainTermination.timeLimitSec}
                                                onChange={(e) =>
                                                    handleConfigChange('mainTermination', {
                                                        ...solverConfig.mainTermination,
                                                        timeLimitSec: parseInt(e.target.value) || 0
                                                    })
                                                }
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={4}>
                                            <TextField
                                                label="No-Improve Iters"
                                                type="number"
                                                size="small"
                                                fullWidth
                                                value={solverConfig.mainTermination.noImproveIters}
                                                onChange={(e) =>
                                                    handleConfigChange('mainTermination', {
                                                        ...solverConfig.mainTermination,
                                                        noImproveIters: parseInt(e.target.value) || 0
                                                    })
                                                }
                                            />
                                        </Grid>
                                    </Grid>
                                </SubCard>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Typography variant="h6">Hyperparameters</Typography>
                                {Object.keys(solverConfig.mainHyperparameters).map((param) => (
                                    <TextField
                                        key={param}
                                        label={param}
                                        fullWidth
                                        value={solverConfig.mainHyperparameters[param]}
                                        onChange={(e) =>
                                            handleConfigChange('mainHyperparameters', {
                                                ...solverConfig.mainHyperparameters,
                                                [param]: e.target.value
                                            })
                                        }
                                        size="small"
                                        margin="dense"
                                        required
                                        type="number"
                                    />
                                ))}
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6">Search Operators</Typography>
                                <Grid container spacing={2}>
                                    {getAllowedCategories(solverConfig.mainMethodology).includes('intraRoute') &&
                                        renderSearchOperators(solverConfig.mainSearchOperators.intraRoute, 'intraRoute')}
                                    {getAllowedCategories(solverConfig.mainMethodology).includes('interRoute') &&
                                        renderSearchOperators(solverConfig.mainSearchOperators.interRoute, 'interRoute')}
                                    {getAllowedCategories(solverConfig.mainMethodology).includes('destroy') &&
                                        renderSearchOperators(solverConfig.mainSearchOperators.destroy, 'destroy')}
                                    {getAllowedCategories(solverConfig.mainMethodology).includes('repair') &&
                                        renderSearchOperators(solverConfig.mainSearchOperators.repair, 'repair')}
                                </Grid>
                            </Grid>
                        </Grid>
                    </SubCard>
                </Grid>

                {/* Secondary Methodology */}
                <Grid item xs={12}>
                    <SubCard
                        title="Secondary Methodology"
                        content={solverConfig.useSecondaryMethodology}
                        secondary={
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={solverConfig.useSecondaryMethodology}
                                        onChange={(e) => handleConfigChange('useSecondaryMethodology', e.target.checked)}
                                    />
                                }
                                label=""
                            />
                        }
                    >
                        {solverConfig.useSecondaryMethodology && (
                            <Grid container spacing={3}>
                                {/* Methodology selector (same structure as main) */}
                                <Grid item xs={12}>
                                    <Select
                                        value={solverConfig.secondaryMethodology}
                                        onChange={(e) => handleMethodologyChange('secondaryMethodology', e.target.value, false)}
                                        fullWidth
                                    >
                                        {methodologies.map((m) => (
                                            <MenuItem key={m.name} value={m.name}>
                                                {m.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </Grid>

                                {/* Termination Criteria (Secondary) */}
                                <Grid item xs={12}>
                                    <SubCard title="Termination Criteria">
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} md={4}>
                                                <TextField
                                                    label="Max Iterations"
                                                    type="number"
                                                    size="small"
                                                    fullWidth
                                                    value={solverConfig.secondaryTermination.maxIterations}
                                                    onChange={(e) =>
                                                        handleConfigChange('secondaryTermination', {
                                                            ...solverConfig.secondaryTermination,
                                                            maxIterations: parseInt(e.target.value) || 0
                                                        })
                                                    }
                                                />
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <TextField
                                                    label="Time Limit (sec)"
                                                    type="number"
                                                    size="small"
                                                    fullWidth
                                                    value={solverConfig.secondaryTermination.timeLimitSec}
                                                    onChange={(e) =>
                                                        handleConfigChange('secondaryTermination', {
                                                            ...solverConfig.secondaryTermination,
                                                            timeLimitSec: parseInt(e.target.value) || 0
                                                        })
                                                    }
                                                />
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <TextField
                                                    label="No-Improve Iters"
                                                    type="number"
                                                    size="small"
                                                    fullWidth
                                                    value={solverConfig.secondaryTermination.noImproveIters}
                                                    onChange={(e) =>
                                                        handleConfigChange('secondaryTermination', {
                                                            ...solverConfig.secondaryTermination,
                                                            noImproveIters: parseInt(e.target.value) || 0
                                                        })
                                                    }
                                                />
                                            </Grid>
                                        </Grid>
                                    </SubCard>
                                </Grid>

                                {/* Hyperparameters and Operators side-by-side */}
                                <Grid item xs={12} md={6}>
                                    <Typography variant="h6">Hyperparameters</Typography>
                                    {Object.keys(solverConfig.secondaryHyperparameters).map((param) => (
                                        <TextField
                                            key={param}
                                            label={param}
                                            fullWidth
                                            value={solverConfig.secondaryHyperparameters[param]}
                                            onChange={(e) =>
                                                handleConfigChange('secondaryHyperparameters', {
                                                    ...solverConfig.secondaryHyperparameters,
                                                    [param]: e.target.value
                                                })
                                            }
                                        />
                                    ))}
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="h6">Search Operators</Typography>
                                    <Grid container spacing={2}>
                                        {getAllowedCategories(solverConfig.secondaryMethodology).includes('intraRoute') &&
                                            renderSearchOperators(solverConfig.secondarySearchOperators.intraRoute, 'intraRoute', true)}
                                        {getAllowedCategories(solverConfig.secondaryMethodology).includes('interRoute') &&
                                            renderSearchOperators(solverConfig.secondarySearchOperators.interRoute, 'interRoute', true)}
                                        {getAllowedCategories(solverConfig.secondaryMethodology).includes('destroy') &&
                                            renderSearchOperators(solverConfig.secondarySearchOperators.destroy, 'destroy', true)}
                                        {getAllowedCategories(solverConfig.secondaryMethodology).includes('repair') &&
                                            renderSearchOperators(solverConfig.secondarySearchOperators.repair, 'repair', true)}
                                    </Grid>
                                </Grid>
                            </Grid>
                        )}
                    </SubCard>
                </Grid>

                {/* Launch Button */}
                <Grid item xs={12}>
                    <Button variant="contained" color="primary" onClick={launchResolution} disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : 'Launch Resolution'}
                    </Button>
                </Grid>

                {/* Execution Status */}
                {executionStatus && (
                    <Grid item xs={12}>
                        <Snackbar open autoHideDuration={6000} onClose={() => setExecutionStatus(null)}>
                            <Alert severity="success" onClose={() => setExecutionStatus(null)}>
                                Execution Status: {executionStatus}
                            </Alert>
                        </Snackbar>
                    </Grid>
                )}

                {/* Error Handling */}
                {error && (
                    <Grid item xs={12}>
                        <Snackbar open autoHideDuration={6000} onClose={() => setError(null)}>
                            <Alert severity="error" onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        </Snackbar>
                    </Grid>
                )}
            </Grid>
        </MainCard>
    );
};

export default SolverConfigurationPage;
