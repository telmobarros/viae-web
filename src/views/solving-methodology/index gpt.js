import React, { useState, useEffect } from 'react';
import {
    Grid,
    Typography,
    Button,
    TextField,
    Select,
    MenuItem,
    CircularProgress,
    Paper,
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
        mainMethodology: 'Genetic Algorithm',
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

    useEffect(() => {
        // Ensure a default methodology is always selected
        if (!solverConfig.mainMethodology) {
            setSolverConfig((prev) => ({ ...prev, mainMethodology: 'Genetic Algorithm' }));
        }
    }, []);

    const handleConfigChange = (key, value) => {
        setSolverConfig((prev) => ({
            ...prev,
            [key]: value
        }));
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

    const renderOperatorsOrMutations = () => {
        const { mainMethodology, mainSearchOperators } = solverConfig;
        if (mainMethodology === 'Hill Climbing' || mainMethodology === 'Simulated Annealing') {
            return (
                <Grid container spacing={2}>
                    {renderSearchOperators(mainSearchOperators.intraRoute, 'intraRoute')}
                    {renderSearchOperators(mainSearchOperators.interRoute, 'interRoute')}
                </Grid>
            );
        } else if (mainMethodology === 'Genetic Algorithm') {
            return (
                <Grid container spacing={2}>
                    <Typography variant="h6">Mutation Functions</Typography>
                    {renderSearchOperators(mainSearchOperators.intraRoute, 'Mutation Functions')}
                </Grid>
            );
        }
        return null;
    };

    const renderSearchOperators = (operators, category) => {
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
                                <Checkbox
                                    checked={operators[operator].active}
                                    onChange={() => handleCheckboxChange(category, operator)}
                                    sx={{ padding: 0 }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <Slider
                                    value={operators[operator].probability}
                                    onChange={(e, value) => handleSliderChange(category, operator, value)}
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
                                    onChange={(e) => handleInputChange(category, operator, e)}
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

    return (
        <MainCard title="Solver Configuration">
            <Grid container spacing={3}>
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
                                {renderOperatorsOrMutations()}
                            </Grid>
                        </Grid>
                    </SubCard>
                </Grid>
                <Grid item xs={12}>
                    <Button variant="contained" color="primary" onClick={launchResolution} disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : 'Launch Resolution'}
                    </Button>
                </Grid>
                {executionStatus && (
                    <Grid item xs={12}>
                       
