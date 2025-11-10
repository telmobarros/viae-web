import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

// material-ui
import {
    Grid,
    Accordion as MuiAccordion,
    AccordionSummary as MuiAccordionSummary,
    AccordionDetails as MuiAccordionDetails,
    Typography
} from '@mui/material';
import { useTheme, styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// project imports
import GenericCard from './GenericCard';
import { gridSpacing } from 'store/constant';

// assets
import {
    DirectionsCarTwoTone,
    Grid4x4TwoTone,
    StorefrontTwoTone,
    WarehouseTwoTone,
    AssessmentTwoTone,
    TrendingUpTwoTone,
    PeopleTwoTone,
    TimelineTwoTone,
    QueryBuilderTwoTone,
    SpeedTwoTone
} from '@mui/icons-material';
import { IconChartBubble, IconChartDots3, IconChartGridDots } from '@tabler/icons';
import { IconChartBubbleFilled } from '@tabler/icons-react';

// Styled Accordion with no background color and reduced margins
const Accordion = styled(MuiAccordion)(({ theme }) => ({
    backgroundColor: 'transparent',
    margin: '0 !important',
    '&:before': {
        display: 'none'
    }
}));

const AccordionSummary = styled(MuiAccordionSummary)(({ theme }) => ({
    margin: '0 !important',
    minHeight: '0 !important',
    '& .MuiAccordionSummary-content': {
        margin: '0 !important'
    },
    // place the expand icon on the left
    flexDirection: 'row-reverse'
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
    paddingBottom: '0 !important'
}));

// ==============================|| DEFAULT DASHBOARD ||============================== //

const StatsSection = ({ isLoading, stats }) => {
    const theme = useTheme();

    const colors = {
        summary: {
            backgroundColor: 'white',
            bgEffectColor: theme.palette.secondary.dark,
            avatarBg: theme.palette.secondary.light,
            avatarColor: theme.palette.secondary.dark,
            primaryColor: '#000',
            secondaryColor: theme.palette.grey[500]
        },
        summaryDark: {
            backgroundColor: theme.palette.secondary.dark,
            bgEffectColor: theme.palette.secondary[200],
            avatarBg: theme.palette.secondary[800],
            avatarColor: '#fff',
            primaryColor: '#fff',
            secondaryColor: theme.palette.secondary.light
        },
        vehicles: {
            backgroundColor: 'white',
            bgEffectColor: theme.palette.warning.dark,
            avatarBg: theme.palette.warning.light,
            avatarColor: theme.palette.warning.dark,
            primaryColor: '#000',
            secondaryColor: theme.palette.grey[500]
        },
        demand: {
            backgroundColor: 'white',
            bgEffectColor: theme.palette.success.dark,
            avatarBg: theme.palette.success.light,
            avatarColor: theme.palette.success.dark,
            primaryColor: '#000',
            secondaryColor: theme.palette.grey[500]
        },
        demandDark: {
            backgroundColor: theme.palette.success.dark,
            bgEffectColor: theme.palette.success[200],
            avatarBg: theme.palette.success.main,
            avatarColor: '#fff',
            primaryColor: '#fff',
            secondaryColor: theme.palette.success.light
        },
        distances: {
            backgroundColor: 'white',
            bgEffectColor: theme.palette.primary.dark,
            avatarBg: theme.palette.primary.light,
            avatarColor: theme.palette.primary.dark,
            primaryColor: '#000',
            secondaryColor: theme.palette.grey[500]
        },
        distancesDark: {
            backgroundColor: theme.palette.primary.dark,
            bgEffectColor: theme.palette.primary[200],
            avatarBg: theme.palette.primary[800],
            avatarColor: '#fff',
            primaryColor: '#fff',
            secondaryColor: theme.palette.primary.light
        },
        serviceTimes: {
            backgroundColor: 'white',
            bgEffectColor: theme.palette.orange.dark,
            avatarBg: theme.palette.orange.light,
            avatarColor: theme.palette.orange.dark,
            primaryColor: '#000',
            secondaryColor: theme.palette.grey[500]
        },
        timeWindows: {
            backgroundColor: 'white',
            bgEffectColor: theme.palette.error.dark,
            avatarBg: theme.palette.error.light,
            avatarColor: theme.palette.error.dark,
            primaryColor: '#000',
            secondaryColor: theme.palette.grey[500]
        }
    };

    return (
        <Grid container spacing={1}>
            {/* Adjusted spacing to reduce space between Grid items */}
            {/* Customers and Depots */}
            <Grid item xs={12}>
                <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h5">Summary</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={gridSpacing}>
                            <Grid item sm={4} xs={12} md={4} lg={2}>
                                <GenericCard
                                    {...colors.summaryDark}
                                    isLoading={isLoading}
                                    avatarIcon={<PeopleTwoTone fontSize="inherit" />}
                                    primaryText={stats.num_customers}
                                    secondaryText="# Customers"
                                />
                            </Grid>
                            <Grid item sm={4} xs={12} md={4} lg={2}>
                                <GenericCard
                                    {...colors.summaryDark}
                                    isLoading={isLoading}
                                    avatarIcon={<WarehouseTwoTone fontSize="inherit" />}
                                    primaryText={stats.num_depots}
                                    secondaryText="# Depots"
                                />
                            </Grid>
                            <Grid item sm={4} xs={12} md={4} lg={2}>
                                <GenericCard
                                    {...colors.summaryDark}
                                    isLoading={isLoading}
                                    avatarIcon={<DirectionsCarTwoTone fontSize="inherit" />}
                                    primaryText={stats.num_vehicles}
                                    secondaryText="# Vehicles"
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={6} lg={3}>
                                <GenericCard
                                    {...colors.summary}
                                    isLoading={isLoading}
                                    avatarIcon={<IconChartGridDots fontSize="inherit" />}
                                    primaryText={stats.distance_matrix_size}
                                    secondaryText="Distance Matrix Size"
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={6} lg={3}>
                                <GenericCard
                                    {...colors.summary}
                                    isLoading={isLoading}
                                    avatarIcon={<IconChartBubble fontSize="inherit" fill={true} fillOpacity={0.2} />}
                                    primaryText={stats.customer_optimal_n_clusters}
                                    secondaryText="Optimal # Clusters (Customers)"
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            </Grid>
            {/* Vehicles */}
            <Grid item xs={12}>
                <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h5">Capacities (Vehicles)</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={gridSpacing}>
                            <Grid item sm={4} xs={12} md={4} lg={2}>
                                <GenericCard
                                    {...colors.vehicles}
                                    isLoading={isLoading}
                                    avatarIcon={<SpeedTwoTone fontSize="inherit" />}
                                    primaryText={stats.min_vehicle_capacity}
                                    secondaryText="Min."
                                />
                            </Grid>
                            <Grid item sm={4} xs={12} md={4} lg={2}>
                                <GenericCard
                                    {...colors.vehicles}
                                    isLoading={isLoading}
                                    avatarIcon={<SpeedTwoTone fontSize="inherit" />}
                                    primaryText={stats.max_vehicle_capacity}
                                    secondaryText="Max."
                                />
                            </Grid>
                            <Grid item sm={4} xs={12} md={4} lg={2}>
                                <GenericCard
                                    {...colors.vehicles}
                                    isLoading={isLoading}
                                    avatarIcon={<SpeedTwoTone fontSize="inherit" />}
                                    primaryText={stats.avg_vehicle_capacity}
                                    secondaryText="Avg."
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={6} lg={3}>
                                <GenericCard
                                    {...colors.vehicles}
                                    isLoading={isLoading}
                                    avatarIcon={<SpeedTwoTone fontSize="inherit" />}
                                    primaryText={stats.std_vehicle_capacity}
                                    secondaryText="σ - Std. Deviation"
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={6} lg={3}>
                                <GenericCard
                                    {...colors.vehicles}
                                    isLoading={isLoading}
                                    avatarIcon={<SpeedTwoTone fontSize="inherit" />}
                                    primaryText={stats.var_vehicle_capacity}
                                    secondaryText="σ² - Variance"
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            </Grid>
            {/* Demand */}
            <Grid item xs={12}>
                <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h5">Demand</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={gridSpacing}>
                            <Grid item sm={6} xs={12} md={3} lg={1}>
                                <GenericCard
                                    {...colors.demand}
                                    isLoading={isLoading}
                                    avatarIcon={<StorefrontTwoTone fontSize="inherit" />}
                                    primaryText={stats.min_demand}
                                    secondaryText="Min."
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={3} lg={1}>
                                <GenericCard
                                    {...colors.demand}
                                    isLoading={isLoading}
                                    avatarIcon={<StorefrontTwoTone fontSize="inherit" />}
                                    primaryText={stats.max_demand}
                                    secondaryText="Max."
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={3} lg={2}>
                                <GenericCard
                                    {...colors.demand}
                                    isLoading={isLoading}
                                    avatarIcon={<StorefrontTwoTone fontSize="inherit" />}
                                    primaryText={stats.avg_demand}
                                    secondaryText="Avg."
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={3} lg={2}>
                                <GenericCard
                                    {...colors.demand}
                                    isLoading={isLoading}
                                    avatarIcon={<StorefrontTwoTone fontSize="inherit" />}
                                    primaryText={stats.std_demand}
                                    secondaryText="σ - Std. Deviation"
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={3} lg={2}>
                                <GenericCard
                                    {...colors.demand}
                                    isLoading={isLoading}
                                    avatarIcon={<StorefrontTwoTone fontSize="inherit" />}
                                    primaryText={stats.var_demand}
                                    secondaryText="σ² - Variance"
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={3} lg={2}>
                                <GenericCard
                                    {...colors.demand}
                                    isLoading={isLoading}
                                    avatarIcon={<StorefrontTwoTone fontSize="inherit" />}
                                    primaryText={stats.total_demand}
                                    secondaryText="Total"
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={3} lg={2}>
                                <GenericCard
                                    {...colors.demandDark}
                                    isLoading={isLoading}
                                    avatarIcon={<StorefrontTwoTone fontSize="inherit" />}
                                    primaryText={stats.demand_to_capacity_ratio}
                                    secondaryText="Demand/Capacity Ratio"
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            </Grid>
            {/* Distances */}
            <Grid item xs={12}>
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h5">Distances</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={gridSpacing}>
                            <Grid item sm={12} xs={12} md={12} lg={2}>
                                <GenericCard
                                    {...colors.distancesDark}
                                    isLoading={isLoading}
                                    avatarIcon={<IconChartDots3 fontSize="inherit" />}
                                    primaryText={stats.graph_density}
                                    secondaryText="Density (All)"
                                />
                            </Grid>
                            <Grid item sm={6} xs={6} md={4} lg={2}>
                                <GenericCard
                                    {...colors.distances}
                                    isLoading={isLoading}
                                    avatarIcon={<TimelineTwoTone fontSize="inherit" />}
                                    primaryText={stats.min_distance}
                                    secondaryText="Min. (All)"
                                />
                            </Grid>
                            <Grid item sm={6} xs={6} md={4} lg={2}>
                                <GenericCard
                                    {...colors.distances}
                                    isLoading={isLoading}
                                    avatarIcon={<TimelineTwoTone fontSize="inherit" />}
                                    primaryText={stats.max_distance}
                                    secondaryText="Max. (All)"
                                />
                            </Grid>
                            <Grid item sm={6} xs={6} md={4} lg={2}>
                                <GenericCard
                                    {...colors.distances}
                                    isLoading={isLoading}
                                    avatarIcon={<TimelineTwoTone fontSize="inherit" />}
                                    primaryText={stats.avg_distance}
                                    secondaryText="Avg. (All)"
                                />
                            </Grid>
                            <Grid item sm={6} xs={6} md={6} lg={2}>
                                <GenericCard
                                    {...colors.distances}
                                    isLoading={isLoading}
                                    avatarIcon={<TimelineTwoTone fontSize="inherit" />}
                                    primaryText={stats.std_distance}
                                    secondaryText="σ - Std. Deviation (All)"
                                />
                            </Grid>
                            <Grid item sm={6} xs={6} md={6} lg={2}>
                                <GenericCard
                                    {...colors.distances}
                                    isLoading={isLoading}
                                    avatarIcon={<TimelineTwoTone fontSize="inherit" />}
                                    primaryText={stats.var_distance}
                                    secondaryText="σ² - Variance (All)"
                                />
                            </Grid>
                            <Grid item sm={12} xs={12} md={12} lg={2}>
                                <GenericCard
                                    {...colors.distancesDark}
                                    isLoading={isLoading}
                                    avatarIcon={<IconChartDots3 fontSize="inherit" />}
                                    primaryText={stats.customer_density}
                                    secondaryText="Density (Customers)"
                                />
                            </Grid>
                            <Grid item sm={6} xs={6} md={4} lg={2}>
                                <GenericCard
                                    {...colors.distances}
                                    isLoading={isLoading}
                                    avatarIcon={<TimelineTwoTone fontSize="inherit" />}
                                    primaryText={stats.min_customer_distance}
                                    secondaryText="Min. (Customers)"
                                />
                            </Grid>
                            <Grid item sm={6} xs={6} md={4} lg={2}>
                                <GenericCard
                                    {...colors.distances}
                                    isLoading={isLoading}
                                    avatarIcon={<TimelineTwoTone fontSize="inherit" />}
                                    primaryText={stats.max_customer_distance}
                                    secondaryText="Max. (Customers)"
                                />
                            </Grid>
                            <Grid item sm={6} xs={6} md={4} lg={2}>
                                <GenericCard
                                    {...colors.distances}
                                    isLoading={isLoading}
                                    avatarIcon={<TimelineTwoTone fontSize="inherit" />}
                                    primaryText={stats.avg_customer_distance}
                                    secondaryText="Avg. (Customers)"
                                />
                            </Grid>
                            <Grid item sm={6} xs={6} md={6} lg={2}>
                                <GenericCard
                                    {...colors.distances}
                                    isLoading={isLoading}
                                    avatarIcon={<TimelineTwoTone fontSize="inherit" />}
                                    primaryText={stats.std_customer_distance}
                                    secondaryText="σ - Std. Deviation (Customers)"
                                />
                            </Grid>
                            <Grid item sm={6} xs={6} md={6} lg={2}>
                                <GenericCard
                                    {...colors.distances}
                                    isLoading={isLoading}
                                    avatarIcon={<TimelineTwoTone fontSize="inherit" />}
                                    primaryText={stats.var_customer_distance}
                                    secondaryText="σ² - Variance (Customers)"
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            </Grid>
            {/* Service Times */}
            <Grid item xs={12}>
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h5">Service Times</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={gridSpacing}>
                            <Grid item sm={6} xs={12} md={6} lg={2}>
                                <GenericCard
                                    {...colors.serviceTimes}
                                    isLoading={isLoading}
                                    avatarIcon={<QueryBuilderTwoTone fontSize="inherit" />}
                                    primaryText={stats.min_service_time}
                                    secondaryText="Min."
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={6} lg={2}>
                                <GenericCard
                                    {...colors.serviceTimes}
                                    isLoading={isLoading}
                                    avatarIcon={<QueryBuilderTwoTone fontSize="inherit" />}
                                    primaryText={stats.max_service_time}
                                    secondaryText="Max."
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={4} lg={3}>
                                <GenericCard
                                    {...colors.serviceTimes}
                                    isLoading={isLoading}
                                    avatarIcon={<QueryBuilderTwoTone fontSize="inherit" />}
                                    primaryText={stats.avg_service_time}
                                    secondaryText="Avg."
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={4} lg={3}>
                                <GenericCard
                                    {...colors.serviceTimes}
                                    isLoading={isLoading}
                                    avatarIcon={<QueryBuilderTwoTone fontSize="inherit" />}
                                    primaryText={stats.std_service_time}
                                    secondaryText="σ - Std. Deviation"
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={4} lg={2}>
                                <GenericCard
                                    {...colors.serviceTimes}
                                    isLoading={isLoading}
                                    avatarIcon={<QueryBuilderTwoTone fontSize="inherit" />}
                                    primaryText={stats.var_service_time}
                                    secondaryText="σ² - Variance"
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            </Grid>
            {/* Time Windows */}
            <Grid item xs={12}>
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h5">Time Windows</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={gridSpacing}>
                            <Grid item sm={6} xs={12} md={6} lg={2}>
                                <GenericCard
                                    {...colors.timeWindows}
                                    isLoading={isLoading}
                                    avatarIcon={<QueryBuilderTwoTone fontSize="inherit" />}
                                    primaryText={stats.min_time_window}
                                    secondaryText="Min."
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={6} lg={2}>
                                <GenericCard
                                    {...colors.timeWindows}
                                    isLoading={isLoading}
                                    avatarIcon={<QueryBuilderTwoTone fontSize="inherit" />}
                                    primaryText={stats.max_time_window}
                                    secondaryText="Max."
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={4} lg={3}>
                                <GenericCard
                                    {...colors.timeWindows}
                                    isLoading={isLoading}
                                    avatarIcon={<QueryBuilderTwoTone fontSize="inherit" />}
                                    primaryText={stats.avg_time_window}
                                    secondaryText="Avg."
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={4} lg={3}>
                                <GenericCard
                                    {...colors.timeWindows}
                                    isLoading={isLoading}
                                    avatarIcon={<QueryBuilderTwoTone fontSize="inherit" />}
                                    primaryText={stats.std_time_window}
                                    secondaryText="σ - Std. Deviation"
                                />
                            </Grid>
                            <Grid item sm={6} xs={12} md={4} lg={2}>
                                <GenericCard
                                    {...colors.timeWindows}
                                    isLoading={isLoading}
                                    avatarIcon={<QueryBuilderTwoTone fontSize="inherit" />}
                                    primaryText={stats.var_time_window}
                                    secondaryText="σ² - Variance"
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            </Grid>
        </Grid>
    );
};

export default StatsSection;
