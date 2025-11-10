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

// objectives labels
import objectivesLabels from 'utils/objectivesLabels';

// chart data
const chartData = {
    height: 480,
    type: 'bar',
    options: {
        chart: {
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

const FeatureImportanceBarChart = ({ isLoading, featureImportance, model }) => {
    const theme = useTheme();

    const [sortedFeatureImportance, setSortedFeatureImportance] = useState([]);

    const updateChart = () => {
        if (sortedFeatureImportance.length === 0) {
            ApexCharts.exec(`feature-importance-bar-chart-${model}`, 'updateOptions', chartData.options);
            ApexCharts.exec(`feature-importance-bar-chart-${model}`, 'updateSeries', []);
        } else {
            // Determine the best score
            const bestScore = sortedFeatureImportance[0].value;
            const colors = sortedFeatureImportance.map((result) =>
                result.value === bestScore ? theme.palette.secondary.main : theme.palette.primary.main
            );
            console.log(colors);

            const newChartData = {
                ...chartData.options,
                xaxis: {
                    type: 'category',
                    categories: sortedFeatureImportance.map((feature) => feature.label)
                },
                colors: colors,
                series: [
                    {
                        name: 'Results',
                        data: sortedFeatureImportance.map((feature) => feature.value)
                    }
                ]
                // Show the difference between the best score and the other scores
                /*dataLabels: {
                    enabled: true,
                    formatter: (val, opt) => (val === bestScore ? val : `${val} (${Math.abs(val - bestScore).toFixed(2)})`)
                }*/
            };
            ApexCharts.exec(`feature-importance-bar-chart-${model}`, 'updateOptions', newChartData);
            console.log(ApexCharts.getChartByID(`feature-importance-bar-chart-${model}`));
        }
    };

    useEffect(() => {
        if (!featureImportance) return;
        // Create an array of objects with key, value, and label
        const transformedArray = Object.keys(featureImportance).map((key) => {
            const value = featureImportance[key];
            const labelObj = objectivesLabels.find((obj) => obj.value === key);
            return {
                key: key,
                value: value,
                label: labelObj ? labelObj.label : key // Use the key as a fallback if label is not found
            };
        });

        // Sort the array by value in descending order
        transformedArray.sort((a, b) => b.value - a.value);

        setSortedFeatureImportance(transformedArray);
    }, []);

    useEffect(() => {
        updateChart();
    }, [sortedFeatureImportance]);

    return (
        <>
            {isLoading ? (
                <SkeletonTotalGrowthBarChart />
            ) : (
                <Chart
                    {...chartData}
                    options={{
                        ...chartData.options,
                        chart: {
                            id: `feature-importance-bar-chart-${model}`
                        }
                    }}
                />
            )}
        </>
    );
};

FeatureImportanceBarChart.propTypes = {
    isLoading: PropTypes.bool,
    featureImportance: PropTypes.array.isRequired,
    model: PropTypes.string.isRequired
};

export default FeatureImportanceBarChart;
