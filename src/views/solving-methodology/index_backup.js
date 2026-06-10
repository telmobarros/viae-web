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
    Checkbox,
    Snackbar,
    Alert,
    Slider,
    Box,
    Input as MuiInput,
    Switch,
    Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import authAxios from 'utils/axios';
import MainCard from 'ui-component/cards/MainCard';
import SubCard from 'ui-component/cards/SubCard';

const Input = styled(MuiInput)`
    width: 42px;
`;

const SolverConfigurationPage = () => {
    const [solverConfig, setSolverConfig] = useState({
        useClustering: false,
        clusteringParams: { strategy: '', clusters: 0 },
        orchestration: { mode: 'sequential', handoff: 'best_solution', topK: 1 },
        mainMethodology: '',
        mainHyperparameters: {},
        // Per-stage budget and evaluation controls
        mainBudget: { iterations: 1000, timeLimitSec: 0, noImproveLimit: 0 },
        mainEval: { fullEvalEvery: 1 },
        mainRepro: { reproducible: false, seed: '' },
        mainAutoNormalize: true,
        mainSearchOperators: {
            intraRoute: {
                'Adjacent Swap': { active: false, probability: 0 },
                'General Swap': { active: false, probability: 0 },
                'Single Insertion': { active: false, probability: 0 },
                'Block Insertion': { active: false, probability: 0 },
                '2-Opt': { active: false, probability: 0 }
            },
            interRoute: {
                'Shift(n,m)': { active: false, probability: 0 },
                'Swap(n,m)': { active: false, probability: 0 }
            }
        },
        useSecondaryMethodology: false,
        secondaryMethodology: '',
        secondaryHyperparameters: {},
        secondaryBudget: { iterations: 500, timeLimitSec: 0, noImproveLimit: 0 },
        secondaryEval: { fullEvalEvery: 1 },
        secondaryRepro: { reproducible: false, seed: '' },
        secondaryAutoNormalize: true,
        secondarySearchOperators: {
            intraRoute: {
                'Adjacent Swap': { active: false, probability: 0 },
                'General Swap': { active: false, probability: 0 },
                'Single Insertion': { active: false, probability: 0 },
                'Block Insertion': { active: false, probability: 0 },
                '2-Opt': { active: false, probability: 0 }
            },
            interRoute: {
                'Shift(n,m)': { active: false, probability: 0 },
                'Swap(n,m)': { active: false, probability: 0 }
            }
        }
    });

    const instance = useSelector((state) => state.instance.instance);
    const [problemInstances, setProblemInstances] = useState([]);
    const [problemInstanceId, setProblemInstanceId] = useState(0);

    const [loading, setLoading] = useState(false);
    const [executionStatus, setExecutionStatus] = useState(null);
    const [error, setError] = useState(null);

    const methodologies = [
        {
            name: 'Genetic Algorithm',
            params: { 'Population Size': 50, 'Mutation Rate': 0.1 }
        },
        {
            name: 'Simulated Annealing',
            params: { 'Initial Temperature': 100, 'Cooling Rate': 0.9 }
        },
        {
            name: 'Hill Climbing',
            params: { 'Step Size': 1 }
        }
    ];

    const searchOperators = {
        intraRoute: {
            'Adjacent Swap': { active: false, probability: 0 },
            'General Swap': { active: false, probability: 0 },
            'Single Insertion': { active: false, probability: 0 },
            'Block Insertion': { active: false, probability: 0 },
            '2-Opt': { active: false, probability: 0 }
        },
        interRoute: {
            'Shift(n,m)': { active: false, probability: 0 },
            'Swap(n,m)': { active: false, probability: 0 }
        }
    };

    const clusteringStrategies = ['K-Means', 'K-Medoids', 'DBSCAN'];

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

    const handleConfigChange = (key, value) => {
        setSolverConfig((prev) => ({
            ...prev,
            [key]: value
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
        const auto = isSecondary ? solverConfig.secondaryAutoNormalize : solverConfig.mainAutoNormalize;
        if (auto) adjustProbabilities(category, operator, isSecondary);
    };
            updatedOperators[category][operator].probability = value;
            return isSecondary
                ? { ...prev, secondarySearchOperators: updatedOperators }
                : { ...prev, mainSearchOperators: updatedOperators };
        });
        if (solverConfig.autoNormalize) {
            adjustProbabilities(category, operator, isSecondary);
        }
    };

    const handleInputChange = (category, operator, event, isSecondary = false) => {
        const value = event.target.value === '' ? 0 : Number(event.target.value);
        handleSliderChange(category, operator, value, isSecondary);
    };

    const handleCheckboxChange = (category, operator, isSecondary = false) => {
        setSolverConfig((prev) => {
            const updatedOperators = isSecondary ? { ...prev.secondarySearchOperators } : { ...prev.mainSearchOperators };
            updatedOperators[category][operator].active = !updatedOperators[category][operator].active;
            updatedOperators[category][operator].probability = 0;
            return isSecondary
                ? { ...prev, secondarySearchOperators: updatedOperators }
                : { ...prev, mainSearchOperators: updatedOperators };
        });
    };

    const calculateTotalProbability = (isSecondary = false) => {
        const updatedOperators = isSecondary ? solverConfig.secondarySearchOperators : solverConfig.mainSearchOperators;
        const intraTotal = Object.values(updatedOperators.intraRoute).reduce((sum, op) => sum + (op.active ? op.probability : 0), 0);
        const interTotal = Object.values(updatedOperators.interRoute).reduce((sum, op) => sum + (op.active ? op.probability : 0), 0);
        return intraTotal + interTotal;
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
                Object.keys(updatedOperators.intraRoute).forEach((key) => {
                    if (updatedOperators.intraRoute[key].active && operator !== key) {
                        console.log(Math.floor(updatedOperators.intraRoute[key].probability * factor));
                        updatedOperators.intraRoute[key].probability = Math.floor(updatedOperators.intraRoute[key].probability * factor);
                    }
                });
                Object.keys(updatedOperators.interRoute).forEach((key) => {
                    if (updatedOperators.interRoute[key].active && operator !== key) {
                        console.log(Math.floor(updatedOperators.interRoute[key].probability * factor));
                        updatedOperators.interRoute[key].probability = Math.floor(updatedOperators.interRoute[key].probability * factor);
                    }
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
        return (
            <>
                <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom textAlign={'center'}>
                        {category === 'intraRoute' ? 'Intra Route Operators' : 'Inter Route Operators'}
                    </Typography>
                </Grid>
                {Object.keys(operators).map((operator) => (
                    <Grid item xs={12} key={operator} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Grid container spacing={3}>
                            <Grid item xs={3}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={operators[operator].active}
                                            onChange={() => handleCheckboxChange(category, operator, isSecondary)}
                                            sx={{ padding: 0 }}
                                        />
                                    }
                                    label={operator}
                                    labelPlacement="right"
                                />
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

    const launchResolution = async () => {
        setLoading(true);
        setError(null);
        try {
            // Normalize operators to sum 100 across active before sending
            const cfgToSend = { ...solverConfig };
            cfgToSend.mainSearchOperators = normalizeOperatorSet(solverConfig.mainSearchOperators);
            if (solverConfig.useSecondaryMethodology) {
                cfgToSend.secondarySearchOperators = normalizeOperatorSet(solverConfig.secondarySearchOperators);
            }
            const response = await authAxios.post('http://localhost:5000/api/v1/solver/launch', {
                configuration: cfgToSend,
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
                {/* Search Budget */}
                <Grid item xs={12}>
                    <SubCard title="Search Budget">
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="Max Iterations"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    value={solverConfig.maxIterations}
                                    onChange={(e) => handleConfigChange('maxIterations', parseInt(e.target.value) || 0)}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="Time Limit (sec)"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    value={solverConfig.timeLimitSec}
                                    onChange={(e) => handleConfigChange('timeLimitSec', parseInt(e.target.value) || 0)}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="No-Improve Limit"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    value={solverConfig.noImproveLimit}
                                    onChange={(e) => handleConfigChange('noImproveLimit', parseInt(e.target.value) || 0)}
                                />
                            </Grid>
                        </Grid>
                    </SubCard>
                </Grid>

                {/* Reproducibility & Evaluation */}
                <Grid item xs={12}>
                    <SubCard title="Reproducibility & Evaluation">
                        <Grid container spacing={2}>
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
                                <TextField
                                    label="Full Eval Every N Moves"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    value={solverConfig.fullEvalEvery}
                                    onChange={(e) => handleConfigChange('fullEvalEvery', parseInt(e.target.value) || 1)}
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
                                    {renderSearchOperators(solverConfig.mainSearchOperators.intraRoute, 'intraRoute')}
                                    {renderSearchOperators(solverConfig.mainSearchOperators.interRoute, 'interRoute')}
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
                                <Grid item xs={12}>
                                    <Typography variant="h6">Methodology</Typography>
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
                                        {renderSearchOperators(solverConfig.secondarySearchOperators.intraRoute, 'intraRoute', true)}
                                        {renderSearchOperators(solverConfig.secondarySearchOperators.interRoute, 'interRoute', true)}
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

