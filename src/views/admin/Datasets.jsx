import { useEffect, useMemo, useState, useRef } from 'react';
import authAxios from 'utils/axios';
import io from 'socket.io-client';

import {
    Avatar,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
    Link,
    List as MuiList,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemText,
    Stack,
    Step,
    StepLabel,
    Stepper,
    Tooltip,
    Typography
} from '@mui/material';
import { Add } from '@mui/icons-material';
import {
    ArrayInput,
    BooleanField,
    BooleanInput,
    Create,
    CreateButton,
    Datagrid,
    DateField,
    Edit,
    ExportButton,
    FilterButton,
    List,
    SelectColumnsButton,
    setSubmissionErrors,
    SimpleForm,
    SimpleFormIterator,
    TextField,
    TextInput,
    TopToolbar
} from 'react-admin';

import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';

const alignCenterPx0 = {
    muiTableHeadCellProps: { align: 'center' },
    muiTableBodyCellProps: { align: 'center', sx: { px: 0 } }
};

const sources = [
    { name: 'VRP-REP', url: 'https://www.vrp-rep.org/' },
    { name: 'CVRPLIB', url: 'http://vrp.galgos.inf.puc-rio.br/' }
];
const steps = ['Select Source', 'Datasets Extraction'];

function LinearProgressWithLabel(props) {
    let value = 0;
    let progressStr = '';
    if (props.num && props.den) {
        value = (props.num / props.den) * 100;
        progressStr = `${props.num}/${props.den}`;
    } else if (props.value) {
        value = props.value;
        progressStr = `${Math.round(value)}%`;
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: '100%', mr: 1 }}>
                <LinearProgress variant="determinate" value={value} {...props} />
            </Box>
            <Box sx={{ minWidth: 35 }}>
                <Typography variant="body2" color="text.secondary">
                    {progressStr}
                </Typography>
            </Box>
        </Box>
    );
}

function ExtractDatasetsDialog(props) {
    const { onClose, open, setSelectedSource, goToImportDialog } = props;
    const [activeStep, setActiveStep] = useState(0);
    const [progress, setProgress] = useState(null);
    const [total, _setTotal] = useState(null);
    const [logs, setLogs] = useState([]);
    const [finishMsg, setFinishMsg] = useState(false);
    const totalRef = useRef(total);
    const setTotal = (data) => {
        totalRef.current = data;
        _setTotal(data);
    };

    const handleClose = () => {
        onClose();
    };

    const handleListItemClick = (value) => {
        setSelectedSource(value);
        // Create a WebSocket connection to listen for progress updates
        const socket = io(`http://localhost:5000/extract_updates`, {
            transports: ['websocket'],
            cors: {
                origin: 'http://localhost:3000/'
            }
        });
        console.log(socket);
        socket.on('connect', () => {
            authAxios
                .post('http://localhost:5000/api/v1/datasets/extract', {
                    name: value,
                    socketId: socket.id
                })
                .then((apiResponse) => {
                    console.log(apiResponse);

                    // Listen for 'scraping_progress' event
                    socket.on('update', (data) => {
                        // Update the progress state
                        // setProgress(data.progress);
                        console.log(data);
                        //setProgress(data.progress);
                        let log = '';
                        switch (data.state) {
                            case 'GET_ALL_DATASETS':
                                log = 'Getting all datasets ...';
                                break;
                            case 'STARTING':
                                log = `Metrics retrieved: ${data.metrics.missing}/${data.metrics.extracted}/${data.metrics.applicable}/${data.metrics.total} (# Missing/ # Extracted/ # Applicable/ # Total)`;
                                setTotal(data.metrics.missing);
                                break;
                            case 'EXTRACTING':
                                setProgress(data.current);
                                console.log(data);
                                console.log(total);
                                console.log(totalRef.current);
                                log = `[${data.current}/${totalRef.current}] Extracting '${data.id}' ...`;

                                console.log(log);
                                break;
                            case 'SUCCESS':
                                setFinishMsg('EXTRACTION FINISHED SUCCESSFULLY');
                                break;
                            case 'ERROR':
                                setFinishMsg(data.error);
                                break;
                            default:
                                console.log('Unknown state', data.state);
                        }
                        setLogs((prevLogs) => [...prevLogs, log]);
                    });
                })
                .catch((error) => {
                    console.log(error);
                });
        });
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    return (
        <Dialog onClose={handleClose} open={open} fullWidth={true} maxWidth="sm">
            <DialogTitle>Dataset extraction</DialogTitle>
            <DialogContent>
                <Box sx={{ width: '100%', paddingX: '10px' }}>
                    <Stepper activeStep={activeStep} alternativeLabel>
                        {steps.map((label, index) => {
                            return (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            );
                        })}
                    </Stepper>
                    {activeStep === 0 ? (
                        <>
                            <Typography sx={{ mt: 2, mb: 1 }}>Select the source to extract/update datasets</Typography>
                            <MuiList sx={{ pt: 0 }}>
                                {sources.map((source) => (
                                    <ListItem key={source.name}>
                                        <ListItemButton onClick={() => handleListItemClick(source.name)}>
                                            <ListItemText
                                                primary={source.name}
                                                secondary={
                                                    <Link
                                                        onClick={(event) => {
                                                            window.open(source.url, '_blank');
                                                            event.stopPropagation();
                                                        }}
                                                    >
                                                        {source.url}
                                                    </Link>
                                                }
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </MuiList>
                        </>
                    ) : null}
                    {activeStep === 1 ? (
                        <Stack spacing={2} sx={{ my: 2 }}>
                            {logs.map((log, index) => (
                                <Typography sx={{ textAlign: 'center' }}>{log}</Typography>
                            ))}
                            <Box sx={{ width: '100%' }}>
                                {progress && !finishMsg ? <LinearProgressWithLabel num={progress} den={total} /> : <LinearProgress />}
                            </Box>

                            {finishMsg && <Typography sx={{ textAlign: 'center' }}>{finishMsg}</Typography>}
                        </Stack>
                    ) : null}
                </Box>
            </DialogContent>
            {finishMsg && (
                <DialogActions>
                    <Button size="small" onClick={goToImportDialog} variant="contained">
                        View datasets
                    </Button>
                    <Button
                        size="small"
                        onClick={() => {
                            window.location.reload();
                        }}
                    >
                        Refresh page
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
}

const RawDatasetsTable = (props) => {
    //data and fetching state
    const [data, setData] = useState([]);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);

    //table state
    const [columnFilters, setColumnFilters] = useState([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([]);
    const [rowSelection, setRowSelection] = useState({});
    /*const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10
    });*/

    useEffect(() => {
        const fetchData = async () => {
            if (!data.length) {
                setIsLoading(true);
            } else {
                setIsRefetching(true);
            }

            try {
                //const response = await fetch(url.href);
                authAxios
                    .get('http://localhost:5000/api/v1/datasets/list_raw')
                    .then((apiResponse) => {
                        setData(apiResponse.data);
                        setRowCount(apiResponse.length);
                    })
                    .catch((error) => {
                        console.log(error);
                    });
            } catch (error) {
                setIsError(true);
                console.error(error);
                return;
            }
            setIsError(false);
            setIsLoading(false);
            setIsRefetching(false);
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // after row selection, update list of selected codes (indicators/risk values) tho show on dialog bottom
    useEffect(() => {
        console.log('rowSelection', rowSelection);
        let tmpDt = [];
        for (const id in rowSelection) {
            let tmpId = id.split('___');
            tmpDt.push({ source: tmpId[0], internal_id: tmpId[1] });
        }
        tmpDt.sort((a, b) => {
            if (a.source === b.source) {
                return a.internal_id.localeCompare(b.internal_id);
            } else {
                return a.source.localeCompare(b.source);
            }
        });
        props.setSelectedDatasets(tmpDt);
    }, [rowSelection]);

    //if you want to avoid useEffect, look at the React Query example instead
    /*useEffect(() => {
        const fetchData = async () => {
            if (!data.length) {
                setIsLoading(true);
            } else {
                setIsRefetching(true);
            }

            const url = new URL(
                '/api/data',
                process.env.NODE_ENV === 'production' ? 'https://www.material-react-table.com' : 'http://localhost:3000'
            );
            url.searchParams.set('start', `${pagination.pageIndex * pagination.pageSize}`);
            url.searchParams.set('size', `${pagination.pageSize}`);
            url.searchParams.set('filters', JSON.stringify(columnFilters ?? []));
            url.searchParams.set('globalFilter', globalFilter ?? '');
            url.searchParams.set('sorting', JSON.stringify(sorting ?? []));

            try {
                //const response = await fetch(url.href);
                const response = await authAxios.get('http://localhost:5000/api/v1/datasets/list_raw');
                const json = await response.json();
                setData(json.data);
                setRowCount(json.meta.totalRowCount);
            } catch (error) {
                setIsError(true);
                console.error(error);
                return;
            }
            setIsError(false);
            setIsLoading(false);
            setIsRefetching(false);
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);*/

    const sourceMap = { cvrplib: 'CVRPLIB', vrp_rep: 'VRP-REP' };
    const columns = useMemo(
        () => [
            {
                accessorKey: 'internal_id',
                header: 'Internal ID',
                size: 100,
                ...alignCenterPx0
            },
            {
                accessorKey: 'title',
                header: 'Title',
                size: 150,
                ...alignCenterPx0
            },
            {
                accessorKey: 'n_results',
                header: '# Results',
                filterVariant: 'range-slider',
                filterFn: 'betweenInclusive', // default (or between)
                muiFilterSliderProps: {
                    marks: true,
                    max: 20, //custom max (as opposed to faceted max)
                    min: 0, //custom min (as opposed to faceted min)
                    step: 1
                },
                size: 100,
                ...alignCenterPx0
            },
            {
                accessorKey: 'n_instances',
                header: '# Instances',
                filterVariant: 'range-slider',
                filterFn: 'betweenInclusive', // default (or between)
                muiFilterSliderProps: {
                    marks: true,
                    max: 110, //custom max (as opposed to faceted max)
                    min: 0, //custom min (as opposed to faceted min)
                    step: 10
                },
                size: 100,
                ...alignCenterPx0
            },
            {
                accessorKey: 'source',
                header: 'Source',
                Cell: ({ cell }) => sourceMap[cell.getValue()],
                filterVariant: 'multi-select',
                filterSelectOptions: [
                    { label: 'CVRPLIB', value: 'cvrplib' },
                    { label: 'VRP-REP', value: 'vrp_rep' }
                ],
                size: 100,
                ...alignCenterPx0
            },
            {
                accessorKey: 'variant',
                header: 'Variant',
                Cell: ({ renderedCellValue, row }) => (
                    <div>
                        <Chip label={renderedCellValue} color="info" size="small" />
                    </div>
                ),
                filterVariant: 'multi-select',
                filterSelectOptions: [
                    'ACVRP',
                    'CVRP',
                    'G-VRP',
                    'MDPVRP',
                    'MDPVRPTW',
                    'MDVRP',
                    'MDVRPTW',
                    'MOGenConVRP',
                    'PVRP',
                    'PVRPTW',
                    'VRPSD',
                    'VRPSD-DC (CC)',
                    'VRPSD-DC (LP)',
                    'VRPSD-DC (PP)',
                    'VRPSD-DC (QP)',
                    'VRPTW'
                ],
                size: 150,
                ...alignCenterPx0
            },
            {
                accessorKey: 'file_format',
                header: 'File Format',
                size: 200,
                ...alignCenterPx0
            }
        ],
        []
    );

    const table = useMaterialReactTable({
        columns,
        data,
        enableRowSelection: true,
        enableStickyHeader: true,
        // enableColumnResizing: true,
        getRowId: (row) => row.source + '___' + row.internal_id,
        initialState: {
            density: 'compact',
            showColumnFilters: false,
            sorting: [{ id: 'internal_id', desc: false }],
            pagination: {
                pageIndex: 0,
                pageSize: 25
            }
        },
        muiToolbarAlertBannerProps: isError
            ? {
                  color: 'error',
                  children: 'Error loading data'
              }
            : undefined,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        //onPaginationChange: setPagination,
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        rowCount,
        state: {
            columnFilters,
            globalFilter,
            isLoading,
            rowSelection,
            //pagination,
            showAlertBanner: isError,
            showProgressBars: isRefetching,
            sorting
        }
    });

    return <MaterialReactTable table={table} />;
};

function ImportDatasetsDialog(props) {
    const { onClose, open, selectedSource, setSelectedSource } = props;
    //const [datasets, setDatasets] = useState(null);
    const [selectedDatasets, setSelectedDatasets] = useState([]);
    const [progress, setProgress] = useState(null);
    const [total, setTotal] = useState(null);
    const [logs, setLogs] = useState([]);
    const [finishMsg, setFinishMsg] = useState(false);
    const [importStarted, setImportStarted] = useState(false);

    const handleClose = () => {
        onClose();
    };

    /* const getDatasets = () => {
        authAxios
            .get('http://localhost:5000/api/v1/datasets/list_raw')
            .then((apiResponse) => {
                setDatasets(apiResponse.data);
            })
            .catch((error) => {
                console.log(error);
            });
    };*/

    /*useEffect(() => {
        console.log('ImportDatasetsDialog', open);
        if (!datasets) {
            getDatasets();
        }
    }, [open]);*/

    const handleSubmit = () => {
        setImportStarted(true);
        setTotal(selectedDatasets.length);
        // Create a WebSocket connection to listen for progress updates
        const socket = io(`http://localhost:5000/import_updates`, {
            transports: ['websocket'],
            cors: {
                origin: 'http://localhost:3000/'
            }
        });
        console.log(socket);
        socket.on('connect', () => {
            authAxios
                .post('http://localhost:5000/api/v1/datasets/import', {
                    datasets: selectedDatasets,
                    socketId: socket.id
                })
                .then((apiResponse) => {
                    console.log(apiResponse);

                    let progress = 0;
                    setProgress(0);
                    let progressStatusMap = {};
                    socket.on('update', (data) => {
                        // Update the progress state
                        console.log(data);
                        let log = '';
                        switch (data.state) {
                            case 'SUCCESS':
                                progress += 1;
                                setProgress(progress);
                                log = `[${progress}/${selectedDatasets.length}] '${data.internal_id}' (${data.source}) imported successfully.`;
                                console.log(log);
                                break;
                            case 'IMPORTING':
                                log = `[${progress}/${selectedDatasets.length}] Importing '${data.internal_id}' (${data.current_instance}/${data.total_instance}) - ${data.instance_file} ...`;
                                setLogs((prevLogs) => {
                                    const updatedLogs = [...prevLogs, log];
                                    // Save the log index for this dataset
                                    progressStatusMap[`${data.internal_id}__${data.current_instance}`] = updatedLogs.length - 1;
                                    return updatedLogs;
                                });
                                break;
                            case 'IMPORT_SUCCESS':
                                setLogs((prevLogs) => {
                                    const updatedLogs = [...prevLogs];
                                    const logIndex = progressStatusMap[`${data.internal_id}__${data.current_instance}`];
                                    if (logIndex !== undefined) {
                                        updatedLogs[logIndex] = '✅ ' + updatedLogs[logIndex];
                                    }
                                    return updatedLogs;
                                });
                                break;
                            case 'IMPORT_ERROR':
                                setLogs((prevLogs) => {
                                    const updatedLogs = [...prevLogs];
                                    const logIndex = progressStatusMap[`${data.internal_id}__${data.current_instance}`];
                                    if (logIndex !== undefined) {
                                        updatedLogs[logIndex] = '❌ ' + updatedLogs[logIndex];
                                    }
                                    return updatedLogs;
                                });
                                break;
                            case 'IMPORTING':
                                log = `[${progress}/${selectedDatasets.length}] Importing '${data.internal_id}' (${data.current_instance}/${data.total_instance}) - ${data.instance_file} ...`;
                                break;
                            case 'IMPORT_SUCCESS':
                                // append correct (green check) emoji to the previous log in logs
                                setLogs((prevLogs) => {
                                    const updatedLogs = [...prevLogs];
                                    updatedLogs[updatedLogs.length - 1] = '✅ ' + updatedLogs[updatedLogs.length - 1];
                                    return updatedLogs;
                                });
                                break;
                            case 'IMPORT_ERROR':
                                // append error (red cross) emoji to the previous log in logs
                                setLogs((prevLogs) => {
                                    const updatedLogs = [...prevLogs];
                                    updatedLogs[updatedLogs.length - 1] = '❌ ' + updatedLogs[updatedLogs.length - 1];
                                    return updatedLogs;
                                });
                                break;
                            case 'ERROR':
                                progress += 1;
                                setProgress(progress);
                                log = `[${progress}/${selectedDatasets.length}] '${data.internal_id}' (${data.source}) failed.`;
                                console.log(log);
                                break;
                            default:
                                console.log('Unknown state', data.state);
                        }
                        if (data.state !== 'IMPORTING') {
                            // IMPORTING state has its own process
                            setLogs((prevLogs) => [...prevLogs, log]);
                        }
                        if (progress == selectedDatasets.length) {
                            setFinishMsg('IMPORT FINISHED');
                        }
                    });
                })
                .catch((error) => {
                    console.log(error);
                });
        });
        //const rowSelection = tableRef.current.getState().rowSelection;
        //handleClose();
        /*for (const index in rowSelection) {
            if (rowSelection.hasOwnProperty(index)) {
            const numericIndex = parseInt(index, 10);
            const value = indicators[numericIndex];
            if (!isNaN(numericIndex)) {
                let body = {
                "det_id": value.ID_DET,
                "ind_id": value.ID_INDICADOR,
                "model_id": riskModel.model_id
                };
                const snackBarId = enqueueSnackbar(`Em progresso: Criação de feature [Indicador] - ${value.COD_INDICADOR.replaceAll('_','.')} (${value.COD_DETALHE})`, {
                persist: true, variant: 'info'
                });
                const endpoint = '/api/v1/risk_features/';
                callApiAsync(session.access_token, endpoint, 'POST', null, body)
                .then((response) => {
                    response.json().then((data) => {
                    const selectedInd = [];
                    if (response.ok === true) {
                        value.feature_id = data.id;
                        selectedInd.push(value);
                        onSelectIndicators(selectedInd);
                    }
                    closeSnackbar(snackBarId);
                    });
                })
            }
            }
        }*/
    };

    return (
        <Dialog onClose={handleClose} open={open} fullWidth={true} maxWidth="lg">
            <DialogTitle>Dataset import</DialogTitle>
            <DialogContent>
                {!importStarted ? ( // let the user select the datasets to import
                    <RawDatasetsTable setSelectedDatasets={setSelectedDatasets} />
                ) : (
                    // show the progress of the import
                    <Box sx={{ width: '100%', paddingX: '10px' }}>
                        <Stack spacing={2} sx={{ my: 2 }}>
                            {logs.map((log, index) => (
                                <Typography sx={{ textAlign: 'center' }}>{log}</Typography>
                            ))}
                            {!finishMsg && (
                                <Box sx={{ width: '100%' }}>
                                    {progress != null ? <LinearProgressWithLabel num={progress} den={total} /> : <LinearProgress />}
                                </Box>
                            )}

                            {finishMsg && <Typography sx={{ textAlign: 'center' }}>{finishMsg}</Typography>}
                        </Stack>
                    </Box>
                )}
            </DialogContent>
            <DialogActions justifyContent="space-between">
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} width="100%" margin>
                    <Box
                        sx={{
                            flexShrink: 1,
                            alignSelf: { xs: 'flex-start', sm: 'center' }
                        }}
                    >
                        {selectedDatasets.length > 0 && (
                            <Typography fontWeight="bold">{selectedDatasets.length} datasets selecionados</Typography>
                        )}
                        <Typography variant="body2">
                            {selectedDatasets
                                .slice(0, 5)
                                .map((dataset) => `${dataset.internal_id}(${dataset.source})`)
                                .join(', ')}
                            {selectedDatasets.length > 5 && (
                                <Tooltip
                                    title={selectedDatasets
                                        .slice(5)
                                        .map((dataset) => `${dataset.internal_id}(${dataset.source})`)
                                        .join(', ')}
                                >
                                    {' '}
                                    ...
                                </Tooltip>
                            )}
                        </Typography>
                    </Box>
                    <Stack
                        gap={2}
                        direction={{
                            xs: 'row-reverse',
                            sm: 'row'
                        }}
                        sx={{
                            flexShrink: 0,
                            alignSelf: { xs: 'flex-end', sm: 'center' }
                        }}
                    >
                        <Button onClick={handleClose}>Cancelar</Button>
                        <Button onClick={handleSubmit} variant="contained" color="primary">
                            Importar
                        </Button>
                    </Stack>
                </Stack>
            </DialogActions>
        </Dialog>
    );
}

const DatasetsButtons = (props) => {
    const [extractDialogOpen, setExtractDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [selectedSource, setSelectedSource] = useState(null);

    const openExtractDialog = () => {
        setExtractDialogOpen(true);
    };

    const handleExtractDialogClose = () => {
        setExtractDialogOpen(false);
    };

    const openInportDialog = () => {
        setImportDialogOpen(true);
    };

    const handleImportDialogClose = () => {
        setImportDialogOpen(false);
    };

    const goToImportDialog = () => {
        setExtractDialogOpen(false);
        setImportDialogOpen(true);
    };

    return (
        <>
            <Button variant="outlined" onClick={openExtractDialog}>
                Extract Datasets
            </Button>
            <Button variant="outlined" onClick={openInportDialog}>
                Import Datasets
            </Button>
            <ExtractDatasetsDialog
                open={extractDialogOpen}
                onClose={handleExtractDialogClose}
                setSelectedSource={setSelectedSource}
                goToImportDialog={goToImportDialog}
            />
            <ImportDatasetsDialog
                open={importDialogOpen}
                onClose={handleImportDialogClose}
                selectedSource={selectedSource}
                setSelectedSource={setSelectedSource}
            />
        </>
    );
};

const ListActions = () => (
    <TopToolbar>
        <SelectColumnsButton />
        <CreateButton />
        <ExportButton />
        <DatasetsButtons />
    </TopToolbar>
);

export const DatasetList = () => (
    <List sort={{ field: 'id', order: 'ASC' }} actions={<ListActions />} empty={false}>
        <Datagrid rowClick="edit">
            <TextField source="id" />
            <TextField source="name" />
        </Datagrid>
    </List>
);

export const DatasetCreate = () => (
    <Create>
        <SimpleForm>
            <TextInput source="sid" />
            <TextInput source="name" />
            <TextInput source="author" />
            <TextInput source="source" />
            <TextInput source="reference.authors" />
            <TextInput source="reference.title" />
            <TextInput source="reference.year" />
            <TextInput source="reference.reference" />
            <TextInput source="file_format" />
            <ArrayInput source="instances">
                <SimpleFormIterator inline>
                    <TextInput source="name" />
                    <TextInput source="decimals" />
                    <TextInput source="distance_type" />
                    <TextInput source="rounding_rule" />
                    <BooleanInput source="symmetric" />
                </SimpleFormIterator>
            </ArrayInput>
        </SimpleForm>
    </Create>
);

export const DatasetEdit = () => (
    <Edit>
        <SimpleForm>
            <TextInput source="sid" />
            <TextInput source="name" />
            <TextInput source="author" />
            <TextInput source="source" />
            <TextInput source="reference.authors" />
            <TextInput source="reference.title" />
            <TextInput source="reference.year" />
            <TextInput source="reference.reference" />
            <TextInput source="file_format" />
            <ArrayInput source="instances">
                <SimpleFormIterator inline>
                    <TextField source="id" />
                    <TextInput source="name" />
                    <TextInput source="decimals" />
                    <TextInput source="distance_type" />
                    <TextInput source="rounding_rule" />
                    <BooleanInput source="symmetric" />
                </SimpleFormIterator>
            </ArrayInput>
        </SimpleForm>
    </Edit>
);
