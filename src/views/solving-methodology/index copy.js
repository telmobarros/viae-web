import React, { useState } from 'react';
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
    Switch
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
        mainMethodology: '',
        mainHyperparameters: {},
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
        adjustProbabilities(category, operator, isSecondary);
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
                                    valueLabelDisplay="auto"
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
                        </Grid>
                    </Grid>
                ))}
            </>
        );
    };

    const launchResolution = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await authAxios.post('/api/launch', solverConfig);
            setExecutionStatus(response.data.status);
        } catch (error) {
            setError('Error launching resolution. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainCard title="Solver Configuration">
            <Grid container spacing={3}>
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
