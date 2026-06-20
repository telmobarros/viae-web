import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Badge,
    Box,
    Button,
    Chip,
    Divider,
    Grid,
    IconButton,
    LinearProgress,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    ExpandMore,
    CloseTwoTone,
    PriorityHighTwoTone,
    DoneTwoTone,
    DoneAllTwoTone,
    QuestionMarkTwoTone,
    CompareArrows
} from '@mui/icons-material';
import { IconArrowLeft, IconRefresh, IconFileSpreadsheet } from '@tabler/icons-react';
import { useSnackbar } from 'notistack';

import MainCard from 'ui-component/cards/MainCard';
import GenericCard from 'views/dashboard/Default/GenericCard';
import FeatureImportanceBarChart from 'views/of-comparison-collections/FeatureImportanceBarChart';
import authAxios from 'utils/axios';
import RiskCollectionPositionTable from './RiskCollectionPositionTable';
import RiskCollectionComparisonTable from './RiskCollectionComparisonTable';
import ComparisonDialog from './ComparisonDialog';

// ── Shared formula helpers ────────────────────────────────────────────────────

const FormulaWithTooltips = ({ formula, featureLabels }) => {
    if (!formula) return null;
    const parts = formula.split(/(f\d+)/g);
    return (
        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>
            {parts.map((part, i) => {
                const label = featureLabels?.[part];
                return label ? (
                    <Tooltip key={i} title={label} arrow placement="top">
                        <span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>{part}</span>
                    </Tooltip>
                ) : (
                    <span key={i}>{part}</span>
                );
            })}
        </span>
    );
};

const FeatureLegend = ({ features }) => {
    if (!features?.length) return null;
    return (
        <Box sx={{ mt: 1, mb: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Feature variables:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {features.map((f) => (
                    <Chip
                        key={f.id}
                        size="small"
                        variant="outlined"
                        label={`f${f.id} = ${f.name}`}
                        sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                ))}
            </Box>
        </Box>
    );
};

// ── Color utilities (mirrored from of-comparison-collections/id.js) ───────────

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
        h = s = 0;
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
    return { h: h * 360, s: s * 100, l: l * 100 };
}

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
    } else if (h >= 60 && h < 120) {
        r = x;
        g = c;
    } else if (h >= 120 && h < 180) {
        g = c;
        b = x;
    } else if (h >= 180 && h < 240) {
        g = x;
        b = c;
    } else if (h >= 240 && h < 300) {
        r = x;
        b = c;
    } else if (h >= 300 && h < 360) {
        r = c;
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

function adjustLightness(hex, percentage) {
    let { h, s, l } = hexToHsl(hex);
    l = Math.min(100, Math.max(0, l + percentage));
    return hslToHex(h, s, l);
}

function interpolateColor(color1, color2, factor) {
    const result = color1
        .slice(1)
        .match(/.{2}/g)
        .map((c, i) => Math.round(parseInt(c, 16) + factor * (parseInt(color2.slice(1).match(/.{2}/g)[i], 16) - parseInt(c, 16))));
    return `#${result.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function getColorAndIcon(metric, p_value) {
    let mainColor;
    let icon;
    if (p_value <= 0.05) {
        if (metric <= 0) {
            mainColor = '#ff0000';
        } else if (metric > 0 && metric <= 0.5) {
            mainColor = interpolateColor('#ff0000', '#e9e916', metric / 0.5);
        } else {
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

// ── Stats section ─────────────────────────────────────────────────────────────

const ModelMetricColumn = ({ isLoading, modelMetrics, modelLabel, isBest }) => {
    const theme = useTheme();

    const bestHighlight = { border: '1px solid', borderColor: 'grey.500', borderRadius: '18px', p: 1 };
    const bestBadge = { display: 'inherit', '& .MuiBadge-badge': { right: 70 } };

    if (!modelMetrics) {
        return (
            <Box sx={{ opacity: 0.4, textAlign: 'center', p: 2 }}>
                <Typography variant="h4" sx={{ pb: 1 }}>
                    {modelLabel}
                </Typography>
                <Typography variant="body2">Not available</Typography>
            </Box>
        );
    }

    const { kendall_tau, kendall_p_value, spearman_corr, spearman_p_value } = modelMetrics;
    const ktColors = getColorAndIcon(kendall_tau, kendall_p_value);
    const spColors = getColorAndIcon(spearman_corr, spearman_p_value);

    return (
        <Badge badgeContent={isBest ? 'Best Model' : 0} color="secondary" sx={isBest ? bestBadge : { display: 'inherit' }}>
            <Box sx={isBest ? bestHighlight : {}}>
                <Typography variant="h4" sx={{ textAlign: 'center', pb: 1, textDecoration: isBest ? 'underline' : 'none' }}>
                    {modelLabel}
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <GenericCard
                            isLoading={isLoading}
                            backgroundColor={ktColors.mainColor}
                            bgEffectColor={ktColors.lighterColor}
                            avatarIcon={ktColors.icon}
                            avatarBg={ktColors.darkerColor}
                            avatarColor="#fff"
                            primaryText={typeof kendall_tau === 'number' ? String(kendall_tau) : '—'}
                            primaryColor="#fff"
                            secondaryText="Kendall's Tau"
                            secondaryColor="#fff"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <GenericCard
                            isLoading={isLoading}
                            backgroundColor="white"
                            bgEffectColor={spColors.darkerColor}
                            avatarIcon={spColors.icon}
                            avatarBg={spColors.lighterColor}
                            avatarColor={spColors.mainColor}
                            primaryText={typeof spearman_corr === 'number' ? String(spearman_corr) : '—'}
                            primaryColor="#000"
                            secondaryText="Spearman's Rho"
                            secondaryColor={theme.palette.grey[500]}
                        />
                    </Grid>
                </Grid>
            </Box>
        </Badge>
    );
};

const RiskCollectionStatsSection = ({ isLoading, metrics, bestModel, featureLabels }) => {
    if (!metrics) {
        return (
            <Typography variant="h5" sx={{ textAlign: 'center', pb: 1 }}>
                No metrics yet. Run Copeland counting to derive a formula and compute metrics.
            </Typography>
        );
    }

    const { linear_regression, linear_svm, lasso, ridge, elasticnet, polynomial, pysr } = metrics;
    const best_model = bestModel;
    const allModels = [
        { key: 'linear_regression', label: 'Linear Regression', data: linear_regression },
        { key: 'lasso', label: 'Lasso', data: lasso },
        { key: 'ridge', label: 'Ridge', data: ridge },
        { key: 'elasticnet', label: 'Elastic Net', data: elasticnet },
        { key: 'polynomial', label: 'Polynomial (deg 2)', data: polynomial },
        { key: 'linear_svm', label: 'Linear SVM', data: linear_svm },
        { key: 'pysr', label: 'Symbolic Regression', data: pysr }
    ];
    const hasFeatureImportance = allModels.some((m) => m.data?.feature_importance && Object.keys(m.data.feature_importance).length > 0);

    return (
        <Grid container spacing={2}>
            {allModels.map((m) => (
                <Grid item xs={12} sm={6} md={3} key={m.key}>
                    <ModelMetricColumn isLoading={isLoading} modelMetrics={m.data} modelLabel={m.label} isBest={best_model === m.key} />
                </Grid>
            ))}
            {hasFeatureImportance && (
                <Grid item xs={12}>
                    <Accordion elevation={2}>
                        <AccordionSummary expandIcon={<ExpandMore />} sx={{ flexDirection: 'row-reverse' }}>
                            <Typography variant="h5">Feature Importance</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Feature importance shows which node indicators most strongly influence each model&apos;s predicted risk
                                ordering. The bars represent normalized coefficient magnitudes — a taller bar means the model relies more on
                                that indicator to separate high-risk from low-risk nodes. When several models agree on the same top feature,
                                that characteristic is the most reliable driver of perceived risk in the pairwise training data.
                            </Alert>
                            <Grid container spacing={2}>
                                {allModels
                                    .filter((m) => m.data?.feature_importance && Object.keys(m.data.feature_importance).length > 0)
                                    .map((m) => (
                                        <Grid item xs={12} sm={6} md={3} key={m.key}>
                                            <FeatureImportanceBarChart
                                                isLoading={isLoading}
                                                featureImportance={m.data.feature_importance}
                                                model={`risk-${m.key}`}
                                                featureLabels={featureLabels}
                                            />
                                        </Grid>
                                    ))}
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>
            )}
        </Grid>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const RiskCollectionPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const theme = useTheme();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();

    const [collection, setCollection] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [features, setFeatures] = useState([]);
    const [featureLabels, setFeatureLabels] = useState({});
    const [compareOpen, setCompareOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        authAxios
            .get(`http://localhost:5000/api/v1/risk_collections/${id}`)
            .then((response) => {
                setCollection(response.data.result);
                setIsLoading(false);
            })
            .catch(() => {
                enqueueSnackbar('Failed to load collection', { variant: 'error' });
                setIsLoading(false);
            });
    }, [id]);

    useEffect(() => {
        if (!collection?.model_id) return;
        authAxios
            .get(`http://localhost:5000/api/v1/risk_models/${collection.model_id}`)
            .then((r) => {
                const feats = r.data?.result?.features || [];
                setFeatures(feats);
                setFeatureLabels(Object.fromEntries(feats.map((f) => [`f${f.id}`, f.name])));
            })
            .catch(() => {});
    }, [collection?.model_id]);

    const handleExport = () => {
        setExporting(true);
        authAxios
            .get(`http://localhost:5000/api/v1/risk_collections/${id}/export`, { responseType: 'blob' })
            .then((response) => {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = `risk_collection_${id}_export.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(() => enqueueSnackbar('Export failed', { variant: 'error' }))
            .finally(() => setExporting(false));
    };

    const handleCompareClose = (didChange) => {
        setCompareOpen(false);
        if (didChange) setRefreshKey((k) => k + 1);
    };

    const handleRunCopeland = () => {
        setRunning(true);
        const runningKey = enqueueSnackbar('Running Copeland counting…', {
            variant: 'info',
            persist: true,
            anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
        });
        authAxios
            .post(`http://localhost:5000/api/v1/risk_collections/${id}/run_copeland`)
            .then(() => {
                enqueueSnackbar('Copeland counting complete', {
                    variant: 'success',
                    anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
                });
                setIsLoading(true);
                authAxios.get(`http://localhost:5000/api/v1/risk_collections/${id}`).then((r) => {
                    setCollection(r.data.result);
                    setIsLoading(false);
                });
            })
            .catch((e) =>
                enqueueSnackbar(e?.response?.data?.error || 'Failed', {
                    variant: 'error',
                    anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
                })
            )
            .finally(() => {
                closeSnackbar(runningKey);
                setRunning(false);
            });
    };

    return (
        <MainCard
            title={
                <>
                    <Button
                        size="small"
                        startIcon={<IconArrowLeft size={16} />}
                        onClick={() => navigate(collection?.model_id ? `/risk/${collection.model_id}` : '/risk')}
                        sx={{ mr: 1 }}
                    >
                        Back to Model
                    </Button>
                    <Typography variant="h5" component="span">
                        Collection #{id}
                    </Typography>
                    {collection?.formula && (
                        <Typography variant="subtitle2" sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                            {collection.formula}
                        </Typography>
                    )}
                </>
            }
            secondary={
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CompareArrows fontSize="small" />}
                        onClick={() => setCompareOpen(true)}
                    >
                        New Comparison
                    </Button>
                    <IconButton color="secondary" onClick={handleExport} disabled={exporting} title="Export to Excel">
                        <IconFileSpreadsheet size={20} color={theme.palette.secondary.main} />
                    </IconButton>
                    <IconButton color="secondary" onClick={handleRunCopeland} disabled={running} title="Run Copeland counting">
                        <IconRefresh size={20} color={theme.palette.secondary.main} />
                    </IconButton>
                </Stack>
            }
        >
            {isLoading && <LinearProgress />}
            {!isLoading && (
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <RiskCollectionStatsSection
                            isLoading={isLoading}
                            metrics={collection?.metrics}
                            bestModel={collection?.best_model}
                            featureLabels={featureLabels}
                        />
                    </Grid>
                    {collection?.formula && (
                        <Grid item xs={12}>
                            <Accordion elevation={2}>
                                <AccordionSummary expandIcon={<ExpandMore />} sx={{ flexDirection: 'row-reverse' }}>
                                    <Typography variant="h5">Learned Formulas</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <FeatureLegend features={features} />
                                    <Grid container spacing={1}>
                                        {[
                                            { key: 'linear_regression', label: 'Linear Regression', value: collection.formula },
                                            { key: 'lasso', label: 'Lasso', value: collection.formula_lasso },
                                            { key: 'ridge', label: 'Ridge', value: collection.formula_ridge },
                                            { key: 'elasticnet', label: 'Elastic Net', value: collection.formula_elasticnet },
                                            { key: 'polynomial', label: 'Polynomial (deg 2)', value: collection.formula_poly },
                                            { key: 'linear_svm', label: 'Linear SVM', value: collection.formula_svm },
                                            { key: 'pysr', label: 'Symbolic Regression', value: collection.formula_pysr }
                                        ]
                                            .filter((f) => f.value)
                                            .map((f) => (
                                                <Grid item xs={12} key={f.key}>
                                                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                minWidth: 140,
                                                                pt: 0.25,
                                                                fontWeight: collection.best_model === f.key ? 700 : 400
                                                            }}
                                                        >
                                                            {f.label}
                                                            {collection.best_model === f.key ? ' ★' : ''}
                                                        </Typography>
                                                        <FormulaWithTooltips formula={f.value} featureLabels={featureLabels} />
                                                    </Stack>
                                                </Grid>
                                            ))}
                                    </Grid>
                                </AccordionDetails>
                            </Accordion>
                        </Grid>
                    )}
                    <Grid item xs={12}>
                        <Typography variant="h5" gutterBottom>
                            Ranking
                        </Typography>
                        <RiskCollectionPositionTable collectionId={id} />
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="h5" gutterBottom>
                            Pairwise Comparisons
                        </Typography>
                        <RiskCollectionComparisonTable collectionId={id} refreshKey={refreshKey} />
                    </Grid>
                </Grid>
            )}
            <ComparisonDialog open={compareOpen} onClose={handleCompareClose} collectionId={id} />
        </MainCard>
    );
};

export default RiskCollectionPage;
