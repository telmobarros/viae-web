import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Box, MenuItem, TextField, Tooltip, Typography } from '@mui/material';

// project imports
import MainCard from 'ui-component/cards/MainCard';
import ObjectiveFunctionEditor from './ObjectiveFunctionEditor';

import authAxios from 'utils/axios';

/**
 * Dataset-instance -> problem-instance picker, wrapping the self-contained
 * ObjectiveFunctionEditor (extracted so the problem-instances page can embed
 * the same editor for its own already-selected variant, without a second,
 * duplicate picker).
 */
const ObjectiveFunctionPage = () => {
    const instance = useSelector((state) => state.instance.instance);
    const [problemInstances, setProblemInstances] = useState([]);
    const [problemInstanceId, setProblemInstanceId] = useState(0);

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

    return (
        <Box>
            <MainCard
                title="Objective Function Definition"
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
                <Typography variant="body2" color="textSecondary">
                    Choose which problem instance's objective function to edit.
                </Typography>
            </MainCard>
            <Box sx={{ mt: 3 }}>
                <ObjectiveFunctionEditor problemInstanceId={problemInstanceId} />
            </Box>
        </Box>
    );
};

export default ObjectiveFunctionPage;
