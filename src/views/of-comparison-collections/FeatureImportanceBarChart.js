import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { useTheme } from '@mui/material/styles';
import { Grid, Typography } from '@mui/material';

import ApexCharts from 'apexcharts';
import Chart from 'react-apexcharts';

import SkeletonTotalGrowthBarChart from 'ui-component/cards/Skeleton/TotalGrowthBarChart';

import objectivesLabels from 'utils/objectivesLabels';

const chartData = {
    height: 480,
    type: 'bar',
    options: {
        chart: {
            toolbar: { show: true },
            zoom: { enabled: true }
        },
        responsive: [
            {
                breakpoint: 480,
                options: { legend: { position: 'bottom', offsetX: -10, offsetY: 0 } }
            }
        ],
        plotOptions: {
            bar: {
                borderRadius: 4,
                borderRadiusApplication: 'end',
                horizontal: true,
                columnWidth: '50%',
                distributed: true
            }
        },
        xaxis: { type: 'category', categories: [] },
        fill: { type: 'solid' },
        dataLabels: { enabled: true },
        grid: { show: true },
        legend: { show: false }
    },
    series: []
};

const FeatureImportanceBarChart = ({ isLoading, featureImportance, model, featureLabels = {} }) => {
    const theme = useTheme();
    const [sortedFeatureImportance, setSortedFeatureImportance] = useState([]);

    const updateChart = () => {
        if (sortedFeatureImportance.length === 0) {
            ApexCharts.exec(`feature-importance-bar-chart-${model}`, 'updateOptions', chartData.options);
            ApexCharts.exec(`feature-importance-bar-chart-${model}`, 'updateSeries', []);
        } else {
            const bestScore = sortedFeatureImportance[0].value;
            const colors = sortedFeatureImportance.map((result) =>
                result.value === bestScore ? theme.palette.secondary.main : theme.palette.primary.main
            );

            // Capture sorted list for tooltip closure
            const sorted = sortedFeatureImportance;
            const labels = featureLabels;

            const newChartData = {
                ...chartData.options,
                xaxis: {
                    type: 'category',
                    categories: sorted.map((f) => f.label)
                },
                colors,
                tooltip: {
                    custom: ({ dataPointIndex, w }) => {
                        const item = sorted[dataPointIndex];
                        if (!item) return '';
                        const fullName = labels?.[item.key];
                        const title = fullName && fullName !== item.label ? `${item.label} — ${fullName}` : item.label;
                        const value = w.globals.series[0][dataPointIndex];
                        return `<div style="padding:6px 10px;font-size:0.8rem;line-height:1.4">
                            <strong>${title}</strong><br/>
                            ${typeof value === 'number' ? value.toFixed(4) : value}
                        </div>`;
                    }
                },
                series: [{ name: 'Results', data: sorted.map((f) => f.value) }]
            };
            ApexCharts.exec(`feature-importance-bar-chart-${model}`, 'updateOptions', newChartData);
        }
    };

    useEffect(() => {
        if (!featureImportance) return;
        const transformedArray = Object.keys(featureImportance).map((key) => {
            const value = featureImportance[key];
            const labelObj = objectivesLabels.find((obj) => obj.value === key);
            return {
                key,
                value,
                label: labelObj ? labelObj.label : key
            };
        });
        transformedArray.sort((a, b) => b.value - a.value);
        setSortedFeatureImportance(transformedArray);
    }, [featureImportance]);

    useEffect(() => {
        updateChart();
    }, [sortedFeatureImportance, featureLabels]);

    return (
        <>
            {isLoading ? (
                <SkeletonTotalGrowthBarChart />
            ) : (
                <Chart
                    {...chartData}
                    options={{
                        ...chartData.options,
                        chart: { id: `feature-importance-bar-chart-${model}` }
                    }}
                />
            )}
        </>
    );
};

FeatureImportanceBarChart.propTypes = {
    isLoading: PropTypes.bool,
    featureImportance: PropTypes.object.isRequired,
    model: PropTypes.string.isRequired,
    featureLabels: PropTypes.object
};

export default FeatureImportanceBarChart;
