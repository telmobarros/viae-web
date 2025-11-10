import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
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
    Paper,
    Tooltip,
    FormGroup,
    FormControl,
    Select,
    MenuItem
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { IconArrowDown, IconArrowUp, IconTrash, IconGripVertical } from '@tabler/icons-react';

// project imports
import MainCard from 'ui-component/cards/MainCard';
import OFComparisonCollectionTable from './OFComparisonCollectionTable';

import authAxios from 'utils/axios';

// Styled Toggle Switch
const StyledSwitch = styled(Switch)(({ theme }) => ({
    '& .MuiSwitch-switchBase.Mui-checked': {
        color: theme.palette.secondary.main
    },
    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
        backgroundColor: theme.palette.secondary.main
    }
}));

const initialObjectives = [{ value: 'cost', type: 'min', weight: 1 }];

const commonObjectives = [
    { value: 'n_vehicles', label: 'Number of Vehicles' },
    { value: 'distance', label: 'Total Distance' },
    { value: 'travel_time', label: 'Total Travel Time' },
    { value: 'cost', label: 'Total Cost' },
    { value: 'vehicle_cost', label: 'Vehicle Cost' },
    { value: 'profit', label: 'Profit' },
    { value: 'n_customers', label: 'Number of Customers' },
    { value: 'missed_customers', label: 'Missed Customers' },
    { value: 'customer_waiting_time', label: 'Customer Waiting Time' },
    { value: 'time_window_violations', label: 'Time Window Violations' },
    { value: 'capacity_violations', label: 'Capacity Violations' },
    { value: 'distance_diff', label: 'Distance Imbalance' },
    { value: 'travel_time_diff', label: 'Travel Time Imbalance' },
    { value: 'cost_diff', label: 'Cost Imbalance' }
];

const ObjectiveFunctionPage = () => {
    const [isAdvanced, setIsAdvanced] = useState(false);
    const [lexicographicalObjectives, setLexicographicalObjectives] = useState(initialObjectives);
    const [selectedObjectives, setSelectedObjectives] = useState(['cost']);
    const [weights, setWeights] = useState({ cost: 1 }); // Weights for objectives

    const instance = useSelector((state) => state.instance.instance);
    const [problemInstances, setProblemInstances] = useState([]);
    const [problemInstanceId, setProblemInstanceId] = useState(0);

    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        if (!instance) return;
        authAxios
            .get(`http://localhost:5000/api/v1/dataset_instances/${instance.id}`)
            .then((apiResponse) => {
                setProblemInstances(apiResponse.data.result.problem_instances);
                if (apiResponse.data.result.problem_instances.length > 0)
                    setProblemInstanceId(apiResponse.data.result.problem_instances[0].id);
            })
            .catch((error) => {
                console.log(error);
            });
    }, [instance]);

    const handleToggleChange = (event) => {
        setIsAdvanced(event.target.checked);
    };

    const handleAddObjective = (objective) => {
        if (!selectedObjectives.includes(objective)) {
            setLexicographicalObjectives([
                ...lexicographicalObjectives,
                {
                    value: objective,
                    type: 'min',
                    weight: 1 // Default weight
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
        const updatedObjectives = lexicographicalObjectives.filter((objective) => objective.value !== value);
        setLexicographicalObjectives(updatedObjectives);
        setSelectedObjectives(updatedObjectives.map((obj) => obj.value));
        const updatedWeights = { ...weights };
        delete updatedWeights[value];
        setWeights(updatedWeights);
    };

    const handleTypeChange = (value, newType) => {
        const updatedObjectives = lexicographicalObjectives.map((objective) =>
            objective.value === value ? { ...objective, type: newType } : objective
        );
        setLexicographicalObjectives(updatedObjectives);
    };

    const handleWeightChange = (value, newWeight) => {
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

    const handleCreateOFComparisonCollection = async () => {
        const endpoint = '/api/v1/of_comparison_collections/';
        try {
            const response = await authAxios.post('http://localhost:5000/api/v1/of_comparison_collections/', {
                problem_instance: problemInstanceId
            });
            const data = response.data;
            // navigate(`/of-comparison-collections/${data.id}`);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    return (
        <MainCard
            title="Objective Function Definition"
            secondary={
                <>
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
                    <FormControlLabel
                        control={<StyledSwitch checked={isAdvanced} onChange={handleToggleChange} />}
                        label={isAdvanced ? 'Advanced Mode' : 'Simple Mode'}
                        labelPlacement="start"
                    />
                </>
            }
        >
            <Grid container spacing={3}>
                {/* Inline Checkboxes for Common Objectives */}
                <Grid item xs={12}>
                    <FormControl component="fieldset">
                        <FormGroup row>
                            {commonObjectives.map((objective) => (
                                <FormControlLabel
                                    key={objective.value}
                                    control={
                                        <Checkbox
                                            checked={selectedObjectives.includes(objective.value)}
                                            onChange={handleCheckboxChange}
                                            value={objective.value}
                                            disabled={
                                                !selectedObjectives.includes(objective.value) &&
                                                selectedObjectives.length >= commonObjectives.length
                                            }
                                        />
                                    }
                                    label={objective.label}
                                />
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
                                                commonObjectives.find((obj) => obj.value === objective.value)?.label || objective.value;
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
                                                                        <Grid item xs={2} lg={3}>
                                                                            <Select
                                                                                fullWidth
                                                                                value={objective.type}
                                                                                onChange={(e) =>
                                                                                    handleTypeChange(objective.value, e.target.value)
                                                                                }
                                                                                size="small"
                                                                            >
                                                                                <MenuItem value="min">Minimize</MenuItem>
                                                                                <MenuItem value="max">Maximize</MenuItem>
                                                                            </Select>
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
                                {commonObjectives.map(
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
                                                                            value={weights[objective.value] || ''}
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

                        <Grid item xs={12}>
                            <Typography variant="h6">TODO: place this in a dialog</Typography>
                            <OFComparisonCollectionTable isOpen={true} problemInstanceId={problemInstanceId} />
                            <Button onClick={handleCreateOFComparisonCollection}>New Collection</Button>
                        </Grid>
                    </>
                )}

                {/* Import Functionality */}
                <Grid item xs={12}>
                    <Button variant="outlined" color="primary">
                        Import Objective Function
                    </Button>
                </Grid>
            </Grid>
        </MainCard>
    );
};

export default ObjectiveFunctionPage;
