import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

// material-ui
import { Grid } from '@mui/material';
import { useTheme, styled } from '@mui/material/styles';

// project imports
import EarningCard from './EarningCard';
import PopularCard from './PopularCard';
import TotalOrderLineChartCard from './TotalOrderLineChartCard';
import TotalIncomeDarkCard from './TotalIncomeDarkCard';
import TotalIncomeLightCard from './TotalIncomeLightCard';
import TotalGrowthBarChart from './TotalGrowthBarChart';
import { gridSpacing } from 'store/constant';
import ReactWeather, { useOpenWeather } from 'react-open-weather';
import BestResultsBarChart from './BestResultsBarChart';
import GenericCard from './GenericCard';
import StatsSection from './StatsSection';
import NodeMapWidget from './NodeMapWidget';

import authAxios from 'utils/axios';

// assets
import StorefrontTwoToneIcon from '@mui/icons-material/StorefrontTwoTone';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';

// ==============================|| DEFAULT DASHBOARD ||============================== //

const Dashboard = () => {
    const theme = useTheme();
    const [isLoading, setLoading] = useState(true);

    const instance = useSelector((state) => state.instance.instance);
    const [problemInstances, setProblemInstances] = useState([]);
    const [stats, setStats] = useState({});
    useEffect(() => {
        if (!instance) return;
        authAxios
            .get(`http://localhost:5000/api/v1/dataset_instances/${instance.id}`)
            .then((apiResponse) => {
                console.log(apiResponse.data);
                setProblemInstances(apiResponse.data.result.problem_instances);
                setStats(apiResponse.data.result.stats ?? {});
                setLoading(false);
            })
            .catch((error) => {
                console.log(error);
            });
    }, [instance]);
    const { data, isWeatherLoading, errorMessage } = useOpenWeather({
        key: 'af4e6ee41fd448411a225c66a67015e5',
        lat: '41.2666656',
        lon: '-8.083333',
        lang: 'pt',
        unit: 'metric' // values are (metric, standard, imperial)
    });

    if (instance && instance.id) {
        return (
            <Grid container spacing={gridSpacing}>
                <Grid item xs={12}>
                    <Grid container spacing={gridSpacing}>
                        <Grid item xs={12}>
                            <StatsSection isLoading={isLoading} stats={stats} />
                        </Grid>
                    </Grid>
                </Grid>
                <Grid item xs={12}>
                    <NodeMapWidget instance={instance} />
                </Grid>
                <Grid item xs={12}>
                    <Grid container spacing={gridSpacing}>
                        <Grid item xs={12} md={8}>
                            <BestResultsBarChart isLoading={isLoading} problemInstances={problemInstances} />
                        </Grid>
                        <Grid item xs={12} md={8}>
                            <TotalGrowthBarChart isLoading={isLoading} />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Grid container spacing={gridSpacing}>
                                <Grid item xs={12}>
                                    <ReactWeather
                                        isLoading={isWeatherLoading}
                                        errorMessage={errorMessage}
                                        data={data}
                                        lang="pt"
                                        locationLabel="Amarante"
                                        unitsLabels={{ temperature: 'ºC', windSpeed: 'Km/h' }}
                                        showForecast
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <PopularCard isLoading={isLoading} />
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
                <Grid item xs={12}>
                    <Grid container spacing={gridSpacing}>
                        <Grid item xs={12}>
                            <StatsSection isLoading={isLoading} stats={stats} />
                        </Grid>
                        <Grid item lg={4} md={6} sm={6} xs={12}>
                            <EarningCard isLoading={isLoading} />
                        </Grid>
                        <Grid item lg={4} md={6} sm={6} xs={12}>
                            <TotalOrderLineChartCard isLoading={isLoading} />
                        </Grid>
                        <Grid item lg={4} md={12} sm={12} xs={12}>
                            <Grid container spacing={gridSpacing}>
                                <Grid item sm={6} xs={12} md={6} lg={12}>
                                    <TotalIncomeDarkCard isLoading={isLoading} />
                                </Grid>
                                <Grid item sm={6} xs={12} md={6} lg={12}>
                                    <TotalIncomeLightCard isLoading={isLoading} />
                                </Grid>
                                <Grid item sm={6} xs={12} md={6} lg={12}>
                                    <GenericCard
                                        isLoading={isLoading}
                                        backgroundColor={theme.palette.primary.dark}
                                        bgEffectColor={theme.palette.primary[200]}
                                        avatarIcon={<TableChartOutlinedIcon fontSize="inherit" />}
                                        avatarBg={theme.palette.primary[800]}
                                        avatarColor="#fff"
                                        primaryText="$203k"
                                        primaryColor="#fff"
                                        secondaryText="Total Income"
                                        secondaryColor="primary.light"
                                    />
                                </Grid>

                                <Grid item sm={6} xs={12} md={6} lg={12}>
                                    <GenericCard
                                        isLoading={isLoading}
                                        backgroundColor="white"
                                        bgEffectColor={theme.palette.warning.dark}
                                        avatarIcon={<StorefrontTwoToneIcon fontSize="inherit" />}
                                        avatarBg={theme.palette.warning.light}
                                        avatarColor={theme.palette.warning.dark}
                                        primaryText="$203k"
                                        primaryColor="#000"
                                        secondaryText="Total Income"
                                        secondaryColor={theme.palette.grey[500]}
                                    />
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
        );
    } else {
        /* Some element letting the user know they have to select an instance first with a button to open selectinstancedialog */
        return (
            <Grid container spacing={gridSpacing}>
                <Grid item xs={12}>
                    <h1> Please select an instance first </h1>
                </Grid>
            </Grid>
        );
    }
};

export default Dashboard;
