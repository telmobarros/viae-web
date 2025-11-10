import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

// material-ui
import { useTheme } from '@mui/material/styles';
import { Grid, MenuItem, TextField, Tooltip, Typography } from '@mui/material';

// third-party
import ApexCharts from 'apexcharts';
import Chart from 'react-apexcharts';

// project imports
import SkeletonTotalGrowthBarChart from 'ui-component/cards/Skeleton/TotalGrowthBarChart';
import MainCard from 'ui-component/cards/MainCard';
import { gridSpacing } from 'store/constant';

// chart data
const chartData = {
    height: 480,
    type: 'bar',
    options: {
        chart: {
            id: 'best-results-bar-chart',
            toolbar: {
                show: true
            },
            zoom: {
                enabled: true
            }
        },
        responsive: [
            {
                breakpoint: 480,
                options: {
                    legend: {
                        position: 'bottom',
                        offsetX: -10,
                        offsetY: 0
                    }
                }
            }
        ],
        plotOptions: {
            bar: {
                borderRadius: 4,
                borderRadiusApplication: 'end',
                horizontal: true,
                columnWidth: '50%',
                distributed: true // Distribute the bars on the x-axis
            }
        },
        xaxis: {
            type: 'category',
            categories: []
        },
        fill: {
            type: 'solid'
        },
        dataLabels: {
            enabled: true
        },
        grid: {
            show: true
        },
        legend: {
            show: false
        }
    },
    series: []
};

// ==============================|| DASHBOARD DEFAULT - TOTAL GROWTH BAR CHART ||============================== //

const BestResultsBarChart = ({ isLoading, problemInstances }) => {
    const [value, setValue] = useState(0);
    const theme = useTheme();
    const customization = useSelector((state) => state.customization);
    const [sortedResults, setSortedResults] = useState([]);

    const { navType } = customization;
    const { primary } = theme.palette.text;
    const darkLight = theme.palette.dark.light;
    const grey200 = theme.palette.grey[200];
    const grey500 = theme.palette.grey[500];

    const primary200 = theme.palette.primary[200];
    const primaryDark = theme.palette.primary.dark;
    const secondaryMain = theme.palette.secondary.main;
    const secondaryLight = theme.palette.secondary.light;

    const updateChart = () => {
        if (sortedResults.length === 0) {
            ApexCharts.exec(`best-results-bar-chart`, 'updateOptions', chartData.options);
            ApexCharts.exec(`best-results-bar-chart`, 'updateSeries', []);
        } else {
            // Determine the best score
            const bestScore = sortedResults[0].value;
            const colors = sortedResults.map((result) =>
                result.value === bestScore ? theme.palette.secondary.main : theme.palette.primary.main
            );
            console.log(colors);

            const newChartData = {
                ...chartData.options,
                xaxis: {
                    type: 'category',
                    categories: sortedResults.map(
                        (result) => `${result.solving_methodology} (${result.author}, ${result.reference ? result.reference.year : ''})`
                    )
                },
                colors: colors,
                series: [
                    {
                        name: 'Results',
                        data: sortedResults.map((result) => result.value)
                    }
                ]
                // Show the difference between the best score and the other scores
                /*dataLabels: {
                    enabled: true,
                    formatter: (val, opt) => (val === bestScore ? val : `${val} (${Math.abs(val - bestScore).toFixed(2)})`)
                }*/
            };
            ApexCharts.exec(`best-results-bar-chart`, 'updateOptions', newChartData);
            console.log(ApexCharts.getChartByID('best-results-bar-chart'));
        }
    };

    useEffect(() => {
        if (problemInstances.length > 0) {
            setValue(problemInstances[0].id);
        }
    }, [problemInstances]);

    useEffect(() => {
        if (problemInstances.length > 0) {
            const tmpSortedResults = problemInstances
                .find((problem) => problem.id === value)
                .results.sort((a, b) => {
                    if (a.value === b.value) {
                        return a.reference?.year - b.reference?.year;
                    }
                    return a.value - b.value;
                })
                .slice(0, 15);
            setSortedResults(tmpSortedResults);
        }
    }, [value]);

    useEffect(() => {
        updateChart();
    }, [sortedResults]);

    return (
        <>
            {isLoading ? (
                <SkeletonTotalGrowthBarChart />
            ) : (
                <MainCard>
                    <Grid container spacing={gridSpacing}>
                        <Grid item xs={12}>
                            <Grid container alignItems="center" justifyContent="space-between">
                                <Grid item>
                                    <Grid container direction="column" spacing={1}>
                                        <Grid item>
                                            <Typography variant="subtitle2">Best results</Typography>
                                        </Grid>
                                        <Grid item>
                                            <Typography variant="subtitle">BKS</Typography>

                                            <Typography variant="h3">
                                                {sortedResults.length > 0 ? sortedResults[0].value : 'N/D'}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </Grid>
                                <Grid item>
                                    <TextField
                                        id="select-problem"
                                        select
                                        value={value}
                                        onChange={(e) => {
                                            setValue(e.target.value);
                                        }}
                                    >
                                        {problemInstances.map((option) => (
                                            <MenuItem key={option.id} value={option.id}>
                                                <Tooltip title={option.description}>{option.name}</Tooltip>
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                            </Grid>
                        </Grid>
                        <Grid item xs={12}>
                            <Chart {...chartData} />
                        </Grid>
                    </Grid>
                </MainCard>
            )}
        </>
    );
};

BestResultsBarChart.propTypes = {
    isLoading: PropTypes.bool,
    problemInstances: PropTypes.array.isRequired
};

export default BestResultsBarChart;
