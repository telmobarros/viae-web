import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams, Link } from 'react-router-dom';
import { useNavigate } from 'react-router';
import {
    Box,
    Card,
    Switch,
    FormControlLabel,
    Grid,
    Typography,
    Select,
    MenuItem,
    TextField,
    Button,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Paper,
    Tooltip,
    LinearProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableFooter
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useTheme, styled } from '@mui/material/styles';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Compare } from '@mui/icons-material';
import { IconSquareRoundedCheck, IconSquareRoundedX } from '@tabler/icons';

// third-party
import ApexCharts from 'apexcharts';
import Chart from 'react-apexcharts';

// project imports
import MainCard from 'ui-component/cards/MainCard';

import authAxios from 'utils/axios';
import VRPVisualizer from './VRPVisualizer';
import { lab } from 'd3';

const OFComparisonPage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const theme = useTheme();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const [isLoading, setIsLoading] = useState(true);
    const [comparison, setComparison] = useState();
    const [radarChartData, setRadarChartData] = useState(null);

    const stats = [
        {
            label: 'Number of vehicles',
            accessor: 'n_vehicles',
            radarChart: true
        },
        {
            label: 'Distance',
            accessor: 'distance',
            radarChart: true
        },
        {
            label: 'Travel Time',
            accessor: 'travel_time',
            radarChart: true
        },
        {
            label: 'Cost',
            accessor: 'cost',
            radarChart: true
        },
        {
            label: 'Vehicle Cost',
            accessor: 'vehicle_cost',
            radarChart: true
        },
        {
            label: 'Distance Imbalance',
            accessor: 'distance_diff'
        },
        {
            label: 'Travel Time Imbalance',
            accessor: 'travel_time_diff'
        },
        {
            label: 'Cost Imbalance',
            accessor: 'cost_diff'
        },
        {
            label: 'Customer Waiting Time',
            accessor: 'customer_waiting_time'
        },
        {
            label: 'Profit',
            accessor: 'profit'
        },
        {
            label: 'Number of Customers',
            accessor: 'n_customers'
        },
        {
            label: 'Missed Customers',
            accessor: 'missed_customers'
        },
        {
            label: 'Capacity Violations',
            accessor: 'capacity_violations'
        },
        {
            label: 'Time Window Violations',
            accessor: 'time_window_violations'
        },
        {
            label: 'Feasibility',
            accessor: 'feasibility'
        }
    ];

    useEffect(() => {
        const fetchComparison = async () => {
            try {
                const response = await authAxios.get(`http://localhost:5000/api/v1/of_comparisons/${id}`);
                const data = response.data;
                console.log(response);
                setIsLoading(false);
                if (data.result.length !== 0) {
                    setComparison(data.result);
                    let labels = [];
                    let stats1 = [];
                    let stats2 = [];

                    stats.forEach((stat) => {
                        if (stat.radarChart === true) {
                            labels.push(stat.label);
                            stats1.push(data.result.solution_1[stat.accessor]);
                            stats2.push(data.result.solution_2[stat.accessor]);
                        }
                    });

                    const series = [
                        {
                            name: `#${data.result.solution_id_1}`,
                            data: stats1
                        },
                        {
                            name: `#${data.result.solution_id_2}`,
                            data: stats2
                        }
                    ];

                    const options = {
                        chart: {
                            type: 'radar',
                            height: 500,
                            toolbar: {
                                show: false
                            }
                        },
                        xaxis: {
                            categories: labels
                        },
                        fill: {
                            opacity: 0.1
                        },
                        markers: {
                            size: 4
                        },
                        colors: ['#ffa781', '#5b0e2d'],
                        stroke: {
                            width: 2
                        }
                    };

                    setRadarChartData({ series, options });
                } else {
                    enqueueSnackbar('Error loading the comparison', { variant: 'error' });
                }
            } catch (error) {
                enqueueSnackbar('Error loading the comparison', { variant: 'error' });
            }
        };
        fetchComparison();
    }, [id]);

    const newOFComparison = async (force) => {
        try {
            const response = await authAxios.get(
                `http://localhost:5000/api/v1/of_comparison_collections/${comparison.of_comparison_collection_id}/new_comparison${force ? '?force=true' : ''}`
            );
            const data = response.data;
            setIsLoading(false);

            navigate(`/of-comparisons/${data.result.id}`, { replace: true });
        } catch (error) {
            enqueueSnackbar('Error loading the comparison', { variant: 'error' });
        }
    };

    const handleIgnore = async () => {
        setIsLoading(true);
        newOFComparison(true);
    };

    const handleCompare = async (solution) => {
        setIsLoading(true);
        try {
            const response = await authAxios.put(`http://localhost:5000/api/v1/of_comparisons/${id}`, { preferred: solution });
            const data = response.data;
            newOFComparison(false);
            switch (solution) {
                case 0:
                    enqueueSnackbar(`${comparison.solution_id_1} is preferred.`, { variant: 'info' });
                    break;
                case 1:
                    enqueueSnackbar(`${comparison.solution_id_2} is preferred.`, { variant: 'info' });
                    break;
            }
        } catch (error) {
            enqueueSnackbar('Error loading the comparison', { variant: 'error' });
        }
    };

    const handleCompare1 = async () => {
        await handleCompare(0);
    };
    const handleCompare2 = async () => {
        await handleCompare(1);
    };

    return (
        <MainCard
            title={
                <Typography variant="h5">
                    {!isLoading ? `#${comparison?.solution_id_1} - #${comparison?.solution_id_2}` : 'Loading new comparison...'}
                </Typography>
            }
            secondary={
                <Button variant="outlined" size="small" sx={{ width: '100%' }} onClick={() => navigate(-1)}>
                    Back
                </Button>
            }
        >
            {/* Loading spinner while initial information is gathered */}
            {isLoading && <LinearProgress />}
            {!isLoading && (
                <Card sx={{ overflow: 'hidden' }}>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}
                    >
                        <TableContainer component={Paper}>
                            <Table sx={{ minWidth: 650 }} size="small" aria-label="Comparison Table">
                                <TableHead>
                                    <TableRow>
                                        <TableCell style={{ width: '40%' }}>Solution stats</TableCell>
                                        <TableCell style={{ width: '30%' }} align="right">
                                            #{comparison?.solution_id_1}
                                        </TableCell>
                                        <TableCell style={{ width: '30%' }}>#{comparison?.solution_id_2}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {stats.map((stat) => {
                                        let tc1;
                                        let tc2;
                                        let bgColor1 = 'inherit';
                                        let bgColor2 = 'inherit';
                                        if (stat.accessor === 'feasibility') {
                                            tc1 = comparison?.solution_1?.feasibility ? (
                                                <IconSquareRoundedCheck color="#7bc62d" />
                                            ) : (
                                                <IconSquareRoundedX color="#f44336" />
                                            );

                                            tc2 = comparison?.solution_2?.feasibility ? (
                                                <IconSquareRoundedCheck color="#7bc62d" />
                                            ) : (
                                                <IconSquareRoundedX color="#f44336" />
                                            );
                                        } else {
                                            tc1 = comparison?.solution_1[stat.accessor];
                                            tc2 = comparison?.solution_2[stat.accessor];
                                            if (typeof tc1 === 'number' && !Number.isInteger(tc1)) {
                                                tc1 = tc1?.toFixed(2);
                                            }
                                            if (typeof tc2 === 'number' && !Number.isInteger(tc2)) {
                                                tc2 = tc2?.toFixed(2);
                                            }
                                            if (tc1 < tc2) {
                                                bgColor1 = theme.palette.secondary.light;
                                            } else if (tc1 > tc2) {
                                                bgColor2 = theme.palette.secondary.light;
                                            }
                                        }
                                        return (
                                            <TableRow key={stat.accessor}>
                                                <TableCell component="th" scope="row">
                                                    {stat.label}
                                                </TableCell>
                                                <TableCell align="right" sx={{ backgroundColor: bgColor1 }}>
                                                    {tc1}
                                                </TableCell>
                                                <TableCell sx={{ backgroundColor: bgColor2 }}>{tc2}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell component="th" scope="row">
                                            Which solution is preferred? (
                                            <Link component="button" onClick={handleIgnore}>
                                                Next
                                            </Link>
                                            )
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="outlined" size="small" sx={{ width: '100%' }} onClick={handleCompare1}>
                                                A
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="outlined" size="small" sx={{ width: '100%' }} onClick={handleCompare2}>
                                                B
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </TableContainer>
                        {radarChartData && (
                            <Grid container spacing={3} style={{ marginTop: 20 }}>
                                <Grid item xs={12} md={6} lg={8}>
                                    <VRPVisualizer
                                        isGeographical={false}
                                        solutionIds={[comparison.solution_id_1, comparison.solution_id_2]}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6} lg={4}>
                                    <Chart options={radarChartData.options} series={radarChartData.series} type="radar" height="300px" />
                                </Grid>
                            </Grid>
                        )}
                    </div>
                </Card>
            )}
        </MainCard>
    );
};

export default OFComparisonPage;
