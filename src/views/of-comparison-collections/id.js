import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Badge,
    Box,
    Divider,
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
    LinearProgress
} from '@mui/material';
import { useTheme, styled } from '@mui/material/styles';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { IconArrowDown, IconArrowUp, IconTrash, IconGripVertical } from '@tabler/icons-react';
import {
    Compare,
    ExpandMore,
    CloseTwoTone,
    PriorityHighTwoTone,
    DoneTwoTone,
    DoneAllTwoTone,
    QuestionMarkTwoTone
} from '@mui/icons-material';

// project imports
import MainCard from 'ui-component/cards/MainCard';

import authAxios from 'utils/axios';
import OFComparisonPositionTable from './OFComparisonPositionTable';
import OFComparisonTable from './OFComparisonTable';
import GenericCard from 'views/dashboard/Default/GenericCard';
import { dark } from '@mui/material/styles/createPalette';
import { borderRadius } from '@mui/system';
import FeatureImportanceBarChart from './FeatureImportanceBarChart';

// Utility function to convert HEX to HSL
function hexToHsl(hex) {
    hex = hex.replace('#', '');

    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;

    let max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    let h,
        s,
        l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }

        h /= 6;
    }

    return {
        h: h * 360,
        s: s * 100,
        l: l * 100
    };
}

// Utility function to convert HSL to HEX
function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;

    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    let m = l - c / 2;
    let r = 0,
        g = 0,
        b = 0;

    if (h >= 0 && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (h >= 60 && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (h >= 180 && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (h >= 240 && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else if (h >= 300 && h < 360) {
        r = c;
        g = 0;
        b = x;
    }

    r = Math.round((r + m) * 255)
        .toString(16)
        .padStart(2, '0');
    g = Math.round((g + m) * 255)
        .toString(16)
        .padStart(2, '0');
    b = Math.round((b + m) * 255)
        .toString(16)
        .padStart(2, '0');

    return `#${r}${g}${b}`;
}

// Utility function to get a lighter or darker shade
function adjustLightness(hex, percentage) {
    let { h, s, l } = hexToHsl(hex);
    l = Math.min(100, Math.max(0, l + percentage));
    return hslToHex(h, s, l);
}

// Utility function to interpolate between two colors
function interpolateColor(color1, color2, factor) {
    const result = color1
        .slice(1)
        .match(/.{2}/g)
        .map((c, i) => {
            return Math.round(parseInt(c, 16) + factor * (parseInt(color2.slice(1).match(/.{2}/g)[i], 16) - parseInt(c, 16)));
        });
    return `#${result.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function getColorAndIcon(metric, p_value) {
    let mainColor;
    let icon;

    if (p_value <= 0.05) {
        if (metric <= 0) {
            mainColor = '#ff0000'; // Pure red
        } else if (metric > 0 && metric <= 0.5) {
            // Interpolate between red and yellow
            mainColor = interpolateColor('#ff0000', '#e9e916', metric / 0.5);
        } else {
            // Interpolate between yellow and green
            mainColor = interpolateColor('#e9e916', '#33d339', (metric - 0.5) / 0.5);
        }
        if (metric <= 0.3) {
            icon = <CloseTwoTone fontSize="inherit" />;
        } else if (metric <= 0.6) {
            icon = <PriorityHighTwoTone fontSize="inherit" />;
        } else if (metric <= 0.9) {
            icon = <DoneTwoTone fontSize="inherit" />;
        } else {
            icon = <DoneAllTwoTone fontSize="inherit" />;
        }
    } else {
        mainColor = '#b1b1b1';
        icon = <QuestionMarkTwoTone fontSize="inherit" />;
    }

    return {
        mainColor,
        lighterColor: adjustLightness(mainColor, 40),
        darkerColor: adjustLightness(mainColor, -15),
        icon
    };
}

const OFComparisonCollectionStatsSection = ({ isLoading, ofComparisonCollection }) => {
    const theme = useTheme();
    const customization = useSelector((state) => state.customization);

    const bestModelHighlight = {
        border: '1px solid',
        borderColor: 'grey.500',
        borderRadius: '18px',
        p: 1
    };

    const bestModelBadge = {
        display: 'inherit',
        '& .MuiBadge-badge': {
            right: 70
        }
    };

    return (
        <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
                <Badge
                    badgeContent={ofComparisonCollection.best_model == 'linear_regression' ? 'Best Model' : 0}
                    color="secondary"
                    sx={ofComparisonCollection.best_model == 'linear_regression' ? bestModelBadge : { display: 'inherit' }}
                >
                    <Box sx={ofComparisonCollection.best_model == 'linear_regression' ? bestModelHighlight : {}}>
                        <Typography
                            variant="h4"
                            sx={{
                                textAlign: 'center',
                                pb: 1,
                                textDecoration: ofComparisonCollection.best_model == 'linear_regression' ? 'underline' : 'none'
                            }}
                        >
                            Linear Regression
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                {(() => {
                                    const { mainColor, lighterColor, darkerColor, icon } = getColorAndIcon(
                                        ofComparisonCollection.metrics.linear_regression.kendall_tau,
                                        ofComparisonCollection.metrics.linear_regression.kendall_p_value
                                    );
                                    return (
                                        <GenericCard
                                            isLoading={isLoading}
                                            backgroundColor={mainColor}
                                            bgEffectColor={lighterColor}
                                            avatarIcon={icon}
                                            avatarBg={darkerColor}
                                            avatarColor="#fff"
                                            primaryText={ofComparisonCollection.metrics.linear_regression.kendall_tau}
                                            primaryColor="#fff"
                                            secondaryText="Kendall's Tau"
                                            secondaryColor="#fff"
                                        />
                                    );
                                })()}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                {(() => {
                                    const { mainColor, lighterColor, darkerColor, icon } = getColorAndIcon(
                                        ofComparisonCollection.metrics.linear_regression.spearman_corr,
                                        ofComparisonCollection.metrics.linear_regression.spearman_p_value
                                    );
                                    return (
                                        <GenericCard
                                            isLoading={isLoading}
                                            backgroundColor="white"
                                            bgEffectColor={darkerColor}
                                            avatarIcon={icon}
                                            avatarBg={lighterColor}
                                            avatarColor={mainColor}
                                            primaryText={ofComparisonCollection.metrics.linear_regression.spearman_corr}
                                            primaryColor="#000"
                                            secondaryText="Spearman's Rho"
                                            secondaryColor={theme.palette.grey[500]}
                                        />
                                    );
                                })()}
                            </Grid>
                        </Grid>
                    </Box>
                </Badge>
            </Grid>
            <Grid item xs={12} sm={6}>
                <Badge
                    badgeContent={ofComparisonCollection.best_model == 'linear_svm' ? 'Best Model' : 0}
                    color="secondary"
                    sx={ofComparisonCollection.best_model == 'linear_svm' ? bestModelBadge : { display: 'inherit' }}
                >
                    <Box sx={ofComparisonCollection.best_model == 'linear_svm' ? bestModelHighlight : {}}>
                        <Typography
                            variant="h4"
                            sx={{
                                textAlign: 'center',
                                pb: 1,
                                textDecoration: ofComparisonCollection.best_model == 'linear_svm' ? 'underline' : 'none'
                            }}
                        >
                            Linear SVM
                        </Typography>

                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                {(() => {
                                    const { mainColor, lighterColor, darkerColor, icon } = getColorAndIcon(
                                        ofComparisonCollection.metrics.linear_svm.kendall_tau,
                                        ofComparisonCollection.metrics.linear_svm.kendall_p_value
                                    );
                                    return (
                                        <GenericCard
                                            isLoading={isLoading}
                                            backgroundColor={mainColor}
                                            bgEffectColor={lighterColor}
                                            avatarIcon={icon}
                                            avatarBg={darkerColor}
                                            avatarColor="#fff"
                                            primaryText={ofComparisonCollection.metrics.linear_svm.kendall_tau}
                                            primaryColor="#fff"
                                            secondaryText="Kendall's Tau"
                                            secondaryColor="#fff"
                                        />
                                    );
                                })()}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                {(() => {
                                    const { mainColor, lighterColor, darkerColor, icon } = getColorAndIcon(
                                        ofComparisonCollection.metrics.linear_svm.spearman_corr,
                                        ofComparisonCollection.metrics.linear_svm.spearman_p_value
                                    );
                                    return (
                                        <GenericCard
                                            isLoading={isLoading}
                                            backgroundColor="white"
                                            bgEffectColor={darkerColor}
                                            avatarIcon={icon}
                                            avatarBg={lighterColor}
                                            avatarColor={mainColor}
                                            primaryText={ofComparisonCollection.metrics.linear_svm.spearman_corr}
                                            primaryColor="#000"
                                            secondaryText="Spearman's Rho"
                                            secondaryColor={theme.palette.grey[500]}
                                        />
                                    );
                                })()}
                            </Grid>
                        </Grid>
                    </Box>
                </Badge>
            </Grid>
            {/* Feature Importance */}
            <Grid item xs={12}>
                <Accordion elevation={2}>
                    <AccordionSummary
                        expandIcon={<ExpandMore />}
                        sx={{
                            // place the expand icon on the left
                            flexDirection: 'row-reverse'
                        }}
                    >
                        <Typography variant="h5">Feature Importance</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Feature importance shows which VRP objectives most strongly influenced pairwise solution preferences. The bars
                            represent normalized coefficient magnitudes — a taller bar means the model weighted that objective more heavily
                            when learning to predict which solution experts preferred. When both models (Linear Regression and Linear SVM)
                            agree on the same top objective, that objective is the primary driver of expert preference in this collection.
                        </Alert>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <FeatureImportanceBarChart
                                    isLoading={isLoading}
                                    featureImportance={ofComparisonCollection.metrics.linear_regression.feature_importance}
                                    model="lr"
                                />
                            </Grid>
                            <Divider orientation="vertical" flexItem sx={{ margin: '-1px', display: { xs: 'none', sm: 'block' } }} />
                            <Grid item xs={12} sm={6}>
                                <FeatureImportanceBarChart
                                    isLoading={isLoading}
                                    featureImportance={ofComparisonCollection.metrics.linear_svm.feature_importance}
                                    model="svm"
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            </Grid>
        </Grid>
    );
};

const OFComparisonCollectionPage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const theme = useTheme();
    const [ofComparisonCollection, setOFComparisonCollection] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        authAxios
            .get(`http://localhost:5000/api/v1/of_comparison_collections/${id}`)
            .then((apiResponse) => {
                console.log(apiResponse.data);
                setOFComparisonCollection(apiResponse.data.result);
                setIsLoading(false);
            })
            .catch((error) => {
                console.log(error);
            });
    }, []);

    const newOFComparison = async () => {
        const response = await authAxios.get(`http://localhost:5000/api/v1/of_comparison_collections/${id}/new_comparison`);
        const data = response.data;
        navigate(`/of-comparisons/${data.id}`);
    };

    return (
        <MainCard
            title={
                <>
                    {ofComparisonCollection.name && <Typography variant="h5">{ofComparisonCollection.name}</Typography>}
                    {ofComparisonCollection.description && (
                        <Typography variant="subtitle2">{ofComparisonCollection.description}</Typography>
                    )}
                    {!ofComparisonCollection.name && !ofComparisonCollection.description && (
                        <Typography variant="subtitle1">{id}</Typography>
                    )}
                </>
            }
            secondary={
                <IconButton color="secondary" onClick={newOFComparison}>
                    <Compare fontSize="small" color={theme.palette.secondary.main} />
                </IconButton>
            }
        >
            {/* Loading spinner while initial information is gathered */}
            {isLoading && <LinearProgress />}
            {!isLoading && (
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        {ofComparisonCollection.metrics ? (
                            <OFComparisonCollectionStatsSection isLoading={isLoading} ofComparisonCollection={ofComparisonCollection} />
                        ) : (
                            <Typography variant="h5" sx={{ textAlign: 'center', pb: 1 }}>
                                Stats unavailable. Either no comparisons have been made or the comparisons are still being processed.
                            </Typography>
                        )}
                    </Grid>
                    <Grid item xs={12}>
                        <OFComparisonPositionTable ofComparisonCollectionId={id} />
                    </Grid>
                    <Grid item xs={12}>
                        <OFComparisonTable ofComparisonCollectionId={id} />
                    </Grid>
                </Grid>
            )}
        </MainCard>
    );
};

export default OFComparisonCollectionPage;
