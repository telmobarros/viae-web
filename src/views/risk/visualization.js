import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Box, Button, Chip, CircularProgress, Grid, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { IconArrowLeft, IconEdit } from '@tabler/icons-react';
import { useSnackbar } from 'notistack';

import MainCard from 'ui-component/cards/MainCard';
import authAxios from 'utils/axios';

const CELL = 64; // px per matrix cell
const DOT_R = 5;
const MARGIN = { top: 10, right: 10, bottom: 40, left: 50 };

const stateColor = { PENDING: 'default', IN_PROGRESS: 'info', READY: 'success', ERROR: 'error' };

// ── Matrix SVG ────────────────────────────────────────────────────────────────

const RiskMatrixSVG = ({ model, values, levelMap }) => {
    const { matrix, x_length, y_length, x_name, y_name } = model;

    const W = x_length * CELL;
    const H = y_length * CELL;
    const svgW = W + MARGIN.left + MARGIN.right;
    const svgH = H + MARGIN.top + MARGIN.bottom;

    // Tick positions: one per cell boundary
    const xTicks = Array.from({ length: x_length + 1 }, (_, i) => i / x_length);
    const yTicks = Array.from({ length: y_length + 1 }, (_, i) => i / y_length);

    return (
        <Box sx={{ overflowX: 'auto' }}>
            <svg width={svgW} height={svgH}>
                <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                    {/* Matrix cells */}
                    {matrix.map((row, r) =>
                        row.map((levelId, c) => (
                            <rect
                                key={`${r}-${c}`}
                                x={c * CELL}
                                y={r * CELL}
                                width={CELL}
                                height={CELL}
                                fill={levelMap[levelId]?.color || '#ccc'}
                                stroke="#fff"
                                strokeWidth={1}
                            />
                        ))
                    )}

                    {/* Node dots */}
                    {values.map((v) => {
                        if (v.x_value == null) return null;
                        const cx = v.x_value * W;
                        const cy = (1 - (v.y_value ?? 0.5)) * H;
                        const label = `${v.node_name} · x=${v.x_value.toFixed(3)}${v.y_value != null ? ` · y=${v.y_value.toFixed(3)}` : ''} · ${v.level_name || '—'}`;
                        return (
                            <Tooltip key={v.node_id} title={label} arrow placement="top">
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={DOT_R}
                                    fill={v.level_color || '#333'}
                                    stroke="#fff"
                                    strokeWidth={1.5}
                                    style={{ cursor: 'pointer' }}
                                />
                            </Tooltip>
                        );
                    })}

                    {/* X axis ticks + labels */}
                    {xTicks.map((t, i) => (
                        <g key={i} transform={`translate(${t * W},${H})`}>
                            <line y2={5} stroke="#888" />
                            <text y={18} textAnchor="middle" fontSize={10} fill="#666">
                                {t.toFixed(1)}
                            </text>
                        </g>
                    ))}
                    <text x={W / 2} y={H + 34} textAnchor="middle" fontSize={12} fill="#444" fontWeight="500">
                        {x_name || 'X'}
                    </text>

                    {/* Y axis ticks + labels */}
                    {yTicks.map((t, i) => (
                        <g key={i} transform={`translate(0,${(1 - t) * H})`}>
                            <line x2={-5} stroke="#888" />
                            <text x={-8} dy="0.32em" textAnchor="end" fontSize={10} fill="#666">
                                {t.toFixed(1)}
                            </text>
                        </g>
                    ))}
                    <text
                        transform={`translate(${-36},${H / 2}) rotate(-90)`}
                        textAnchor="middle"
                        fontSize={12}
                        fill="#444"
                        fontWeight="500"
                    >
                        {y_name || 'Y'}
                    </text>
                </g>
            </svg>
        </Box>
    );
};

// ── Level legend ──────────────────────────────────────────────────────────────

const LevelLegend = ({ levels }) => (
    <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
        {[...levels]
            .sort((a, b) => a.value - b.value)
            .map((lvl) => (
                <Chip key={lvl.id} size="small" label={lvl.name} sx={{ bgcolor: lvl.color, color: '#fff', fontWeight: 500 }} />
            ))}
    </Stack>
);

// ── Main page ─────────────────────────────────────────────────────────────────

const RiskModelVisualization = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const [model, setModel] = useState(null);
    const [values, setValues] = useState([]);
    const [loadingModel, setLoadingModel] = useState(true);
    const [loadingValues, setLoadingValues] = useState(true);

    useEffect(() => {
        authAxios
            .get(`http://localhost:5000/api/v1/risk_models/${id}`)
            .then((r) => setModel(r.data?.result || r.data))
            .catch(() => enqueueSnackbar('Failed to load model', { variant: 'error' }))
            .finally(() => setLoadingModel(false));

        authAxios
            .get(`http://localhost:5000/api/v1/risk_models/${id}/values`)
            .then((r) => setValues(r.data?.result || []))
            .catch(() => enqueueSnackbar('Failed to load values', { variant: 'error' }))
            .finally(() => setLoadingValues(false));
    }, [id]);

    const levelMap = useMemo(() => {
        if (!model?.levels) return {};
        return Object.fromEntries(model.levels.map((l) => [l.id, l]));
    }, [model]);

    const columns = useMemo(() => {
        if (!model) return [];
        return [
            { field: 'node_name', headerName: 'Node', flex: 1 },
            {
                field: 'x_value',
                headerName: model.x_name || 'X',
                width: 110,
                type: 'number',
                valueFormatter: ({ value }) => (value != null ? Number(value).toFixed(4) : '—')
            },
            ...(model.y_length > 1
                ? [
                      {
                          field: 'y_value',
                          headerName: model.y_name || 'Y',
                          width: 110,
                          type: 'number',
                          valueFormatter: ({ value }) => (value != null ? Number(value).toFixed(4) : '—')
                      }
                  ]
                : []),
            {
                field: 'level_name',
                headerName: 'Risk Level',
                width: 140,
                renderCell: ({ row }) =>
                    row.level_name ? (
                        <Chip size="small" label={row.level_name} sx={{ bgcolor: row.level_color, color: '#fff', fontWeight: 500 }} />
                    ) : (
                        '—'
                    )
            }
        ];
    }, [model]);

    const isLoading = loadingModel || loadingValues;

    return (
        <MainCard
            title={
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Button size="small" startIcon={<IconArrowLeft size={16} />} onClick={() => navigate('/risk')}>
                        Models
                    </Button>
                    <Typography variant="h5" component="span">
                        {model?.name || `Model #${id}`}
                    </Typography>
                    {model?.state && <Chip label={model.state} size="small" color={stateColor[model.state] || 'default'} />}
                </Stack>
            }
            secondary={
                <Button size="small" startIcon={<IconEdit size={16} />} onClick={() => navigate(`/risk/${id}`)}>
                    Edit
                </Button>
            }
        >
            {isLoading && <LinearProgress />}

            {!loadingModel && model && (
                <Grid container spacing={3}>
                    {/* Matrix + legend */}
                    <Grid item xs={12}>
                        <RiskMatrixSVG model={model} values={values} levelMap={levelMap} />
                        <LevelLegend levels={model.levels || []} />
                    </Grid>

                    {/* Node table */}
                    <Grid item xs={12}>
                        <Typography variant="h5" gutterBottom>
                            Node Risk Values
                        </Typography>
                        {loadingValues ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                <CircularProgress size={24} />
                            </Box>
                        ) : (
                            <DataGrid
                                rows={values}
                                columns={columns}
                                getRowId={(r) => r.node_id}
                                autoHeight
                                disableRowSelectionOnClick
                                initialState={{
                                    sorting: { sortModel: [{ field: 'level_id', sort: 'desc' }] }
                                }}
                                pageSize={25}
                                pageSizeOptions={[25, 50, 100]}
                            />
                        )}
                    </Grid>
                </Grid>
            )}
        </MainCard>
    );
};

export default RiskModelVisualization;
