import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
    Box,
    Button,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { IconSquareRoundedCheck, IconSquareRoundedX } from '@tabler/icons';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import authAxios from 'utils/axios';

const SelectInstanceDialog = ({ isOpen, onClose, onSelectInstance }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [datasets, setDatasets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowSelection, setRowSelection] = useState({});
    const [selectedInstances, setSelectedInstances] = useState([]);
    const tableRef = useRef(null);

    const columns = useMemo(
        () => [
            {
                id: 'name',
                accessorKey: 'name',
                header: 'Name',
                size: 100
            },
            {
                id: 'distance_type',
                accessorKey: 'distance_type',
                header: 'Distance Type',
                size: 100
            },
            /*{
                id: 'decimals',
                accessorKey: 'decimals',
                header: 'Decimals',
                size: 100
            },
            {
                id: 'rounding_rule',
                accessorKey: 'rounding_rule',
                header: 'Rounding Rule',
                size: 150
            },
            {
                id: 'symmetric',
                accessorKey: 'symmetric',
                header: 'Symmetric',
                size: 100
            },*/
            {
                id: 'synthetic',
                accessorKey: 'synthetic',
                header: 'Synthetic',
                size: 100,
                filterVariant: 'checkbox',
                Cell: ({ cell }) => {
                    if (cell.getValue() === true) {
                        return <IconSquareRoundedCheck color="#7bc62d" />;
                    } else {
                        return <IconSquareRoundedX />;
                    }
                }
            },
            {
                id: 'datasetId',
                accessorFn: (row) => `${row.dataset.id} - ${row.dataset.name} (${row.dataset.reference.title})`,
                header: 'Dataset ID',
                size: 200,
                Cell: ({ cell }) => {
                    const { id, name, reference } = cell.row.original.dataset;

                    return (
                        <Box display="inline-block">
                            <Tooltip title={reference.title} style={{ display: 'flex' }}>
                                <Typography variant="caption" color="textSecondary">
                                    #{id}
                                </Typography>
                                <Typography variant="body1">&nbsp;{name}</Typography>
                            </Tooltip>
                        </Box>
                    );
                }
            }
        ],
        []
    );

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                setIsRefetching(true);
                const response = await authAxios.get('http://localhost:5000/api/v1/datasets/', {
                    params: {
                        q: {
                            page_size: 1000
                        }
                    }
                });
                const data = response.data;
                const ids = data.ids;

                const aggregatedData = data.result.flatMap((dataset, index) =>
                    dataset.instances.map((instance) => ({
                        ...instance,
                        dataset: {
                            author: dataset.author,
                            file_format: dataset.file_format,
                            name: dataset.name,
                            reference: dataset.reference,
                            sid: dataset.sid,
                            source: dataset.source,
                            id: ids[index]
                        }
                    }))
                );

                setDatasets(aggregatedData);
                setIsError(false);
            } catch (error) {
                setIsError(true);
                console.error('Error fetching data:', error);
                enqueueSnackbar('Error fetching data', { variant: 'error' });
            } finally {
                setIsLoading(false);
                setIsRefetching(false);
            }
        };

        if (isOpen) {
            fetchData();
        }
    }, [isOpen, enqueueSnackbar]);

    useEffect(() => {
        const selected = Object.keys(rowSelection).map((index) => datasets[parseInt(index, 10)]);
        setSelectedInstances(selected);
    }, [rowSelection, datasets]);

    const handleClose = () => {
        onClose();
    };

    const handleSelect = () => {
        const selected = Object.keys(rowSelection).map((index) => datasets[parseInt(index, 10)])[0];
        onSelectInstance(selected);
    };

    return (
        <Dialog open={isOpen} onClose={handleClose} fullWidth={true} maxWidth={'lg'}>
            <DialogTitle>Select Instance</DialogTitle>
            <DialogContent>
                <DialogContentText style={{ paddingBottom: '10px' }}>Select the instance to change to.</DialogContentText>
                <MaterialReactTable
                    positionToolbarAlertBanner={'none'}
                    positionExpandColumn="first"
                    columns={columns}
                    data={datasets}
                    positionActionsColumn="last"
                    enableExpanding
                    enableGrouping
                    enableColumnDragging={false}
                    enableGlobalFilter={false}
                    enableColumnActions={false}
                    enableStickyHeader
                    autoResetPageIndex={false} // automatically reset the table back to the first page whenever sorting, filtering, or grouping occurs
                    paginateExpandedRows={false} // keep expanded sub rows with their parent row on the same page
                    enableRowSelection
                    enableMultiRowSelection={false}
                    onRowSelectionChange={setRowSelection}
                    initialState={{
                        grouping: ['datasetId'],
                        density: 'compact'
                    }}
                    state={{
                        isLoading,
                        rowSelection,
                        showAlertBanner: isError,
                        showProgressBars: isRefetching
                    }}
                    tableInstanceRef={tableRef}
                    muiTableContainerProps={{
                        sx: {
                            maxHeight: '600px'
                        }
                    }}
                />
            </DialogContent>
            <DialogActions justifyContent="space-between">
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} width="100%" margin>
                    <Box
                        sx={{
                            flexShrink: 1,
                            alignSelf: { xs: 'flex-start', sm: 'center' }
                        }}
                    >
                        {selectedInstances.length > 0 && (
                            <Typography fontWeight="bold">{selectedInstances.length} instance(s) selected</Typography>
                        )}
                        <Typography variant="body2">
                            {selectedInstances
                                .slice(0, 5)
                                .map((instance) => instance.name)
                                .join(', ')}
                            {selectedInstances.length > 5 && (
                                <Tooltip
                                    title={selectedInstances
                                        .slice(5)
                                        .map((instance) => instance.name)
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
                        <Button onClick={handleClose}>Cancel</Button>
                        <Button onClick={handleSelect} variant="contained" color="primary">
                            Select
                        </Button>
                    </Stack>
                </Stack>
            </DialogActions>
        </Dialog>
    );
};

export default SelectInstanceDialog;
