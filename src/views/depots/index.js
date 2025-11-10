import React, { useCallback, useMemo, useState } from 'react';
import authAxios from 'utils/axios';
import { MaterialReactTable } from 'material-react-table';
import RefreshIcon from '@mui/icons-material/Refresh';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

// material-ui
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    Stack,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';

// project imports
import MainCard from 'ui-component/cards/MainCard';

import { DataGrid, GridRowsProp, GridColDef } from '@mui/x-data-grid';

const rows = [
    { id: 1, col1: 'Hello', col2: 'World' },
    { id: 2, col1: 'DataGridPro', col2: 'is Awesome' },
    { id: 3, col1: 'MUI', col2: 'is Amazing' }
];

const columns = [
    { field: 'col1', headerName: 'Column 1', width: 150 },
    { field: 'col2', headerName: 'Column 2', width: 150, editable: true }
];

// ==============================|| DEPOTS ||============================== //

const Example = () => {
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    //const [columns, setColumns] = useState([]);
    const [columnFilters, setColumnFilters] = useState([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10
    });

    const handleCreateNewRow = async (values) => {
        console.log(values);
        const response = await authAxios.post('http://localhost:5000/api/v1/depots/', {
            name: values.name,
            coordinates: {
                coordinates: [parseFloat(values['coordinates.coordinates.0']), parseFloat(values['coordinates.coordinates.1'])],
                type: 'Point'
            }
        });
        refetch();
    };

    const handleSaveRowEdits = async ({ exitEditingMode, row, values }) => {
        if (!Object.keys(validationErrors).length) {
            const response = await authAxios.put(`http://localhost:5000/api/v1/depots/${row.getValue('id')}`, {
                name: values.name,
                coordinates: {
                    coordinates: [parseFloat(values['coordinates.coordinates.0']), parseFloat(values['coordinates.coordinates.1'])],
                    type: 'Point'
                }
            });
            refetch();
            exitEditingMode(); //required to exit editing mode and close modal
        }
    };

    const handleDeleteRow = useCallback(async (row) => {
        if (!confirm(`Are you sure you want to delete ${row.getValue('name')}`)) {
            return;
        }
        const response = await authAxios.delete(`http://localhost:5000/api/v1/depots/${row.getValue('id')}`);
        refetch();
    }, []);

    const getCommonEditTextFieldProps = useCallback(
        (cell) => {
            return {
                error: !!validationErrors[cell.id],
                helperText: validationErrors[cell.id],
                onBlur: (event) => {
                    const isValid =
                        cell.column.id === 'email'
                            ? validateEmail(event.target.value)
                            : cell.column.id === 'age'
                              ? validateAge(+event.target.value)
                              : validateRequired(event.target.value);
                    if (!isValid) {
                        //set validation error for cell if invalid
                        setValidationErrors({
                            ...validationErrors,
                            [cell.id]: `${cell.column.columnDef.header} is required`
                        });
                    } else {
                        //remove validation error for cell if valid
                        delete validationErrors[cell.id];
                        setValidationErrors({
                            ...validationErrors
                        });
                    }
                }
            };
        },
        [validationErrors]
    );

    const { data, isError, isFetching, isLoading, refetch } = useQuery(
        ['table-data', columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting],
        async () => {
            const filters = [];
            columnFilters.forEach(function (item, index) {
                switch (item.id) {
                    case 'name':
                        filters.push({
                            col: 'name',
                            opr: 'ct',
                            value: item.value
                        });
                        break;
                    case 'coordinates.coordinates.0':
                        break;
                    case 'coordinates.coordinates.1':
                        break;
                }
            });

            const response = await authAxios.get('http://localhost:5000/api/v1/depots/', {
                params: {
                    q: {
                        filters: filters,
                        order_column: sorting[0]?.id ?? '',
                        order_direction: sorting[0]?.desc ? 'desc' : 'asc',
                        page: pagination.pageIndex,
                        page_size: pagination.pageSize
                    }
                }
            });
            //.then((response) => {
            //    setMovies(response.data);
            //});
            //const url = new URL('https://www.material-react-table.com/api/data/');
            //url.searchParams.set('start', `${pagination.pageIndex * pagination.pageSize}`);
            //url.searchParams.set('size', `${pagination.pageSize}`);
            //url.searchParams.set('filters', JSON.stringify(columnFilters ?? []));
            //url.searchParams.set('globalFilter', globalFilter ?? '');
            //url.searchParams.set('sorting', JSON.stringify(sorting ?? []));

            //const response = await fetch(url.href);
            console.log(response);
            //const json = await response.json();
            /*let tmp_cls = [];
            Object.keys(response.data.label_columns).forEach(function (key, index) {
                tmp_cls.push({
                    accessorKey: key,
                    header: response.data.label_columns[key]
                });
            });
            console.log(tmp_cls);
            console.log(columns);
            setColumns(tmp_cls);*/
            console.log(columnFilters);
            console.log(globalFilter);
            console.log(sorting);
            console.log(columns);
            return response.data;
        },
        { keepPreviousData: true }
    );

    const columns = useMemo(
        () => [
            {
                accessorKey: 'id',
                header: 'Id',
                enableEditing: false
            },
            {
                accessorKey: 'name',
                header: 'Name',
                muiTableBodyCellEditTextFieldProps: ({ cell }) => ({
                    ...getCommonEditTextFieldProps(cell)
                })
            },
            {
                accessorKey: 'coordinates.coordinates.0',
                header: 'Latitude',
                enableSorting: false,
                filterVariant: 'range',
                muiTableBodyCellEditTextFieldProps: ({ cell }) => ({
                    ...getCommonEditTextFieldProps(cell),
                    type: 'number'
                })
            },
            {
                accessorKey: 'coordinates.coordinates.1',
                header: 'Longitude',
                enableSorting: false,
                filterVariant: 'range',
                muiTableBodyCellEditTextFieldProps: ({ cell }) => ({
                    ...getCommonEditTextFieldProps(cell),
                    type: 'number'
                })
            }
        ],
        []
    );

    const newColumns = useMemo(
        () => [
            {
                accessorKey: 'name',
                header: 'Name'
            },
            {
                accessorKey: 'coordinates.coordinates.0',
                header: 'Latitude'
            },
            {
                accessorKey: 'coordinates.coordinates.1',
                header: 'Longitude'
            }
        ],
        []
    );

    return (
        <>
            <MaterialReactTable
                displayColumnDefOptions={{
                    'mrt-row-actions': {
                        muiTableHeadCellProps: {
                            align: 'center'
                        },
                        size: 120
                    }
                }}
                columns={columns}
                data={data?.result ?? []} //data is undefined on first render
                initialState={{ showColumnFilters: true, columnVisibility: { id: false } }}
                manualFiltering
                manualPagination
                manualSorting
                muiToolbarAlertBannerProps={
                    isError
                        ? {
                              color: 'error',
                              children: 'Error loading data'
                          }
                        : undefined
                }
                onColumnFiltersChange={setColumnFilters}
                onGlobalFilterChange={setGlobalFilter}
                onPaginationChange={setPagination}
                onSortingChange={setSorting}
                editingMode="modal" //default
                enableColumnOrdering
                enableEditing
                onEditingRowSave={handleSaveRowEdits}
                renderRowActions={({ row, table }) => (
                    <Box sx={{ display: 'flex', gap: '1rem' }}>
                        <Tooltip arrow placement="left" title="Edit">
                            <IconButton onClick={() => table.setEditingRow(row)}>
                                <Edit />
                            </IconButton>
                        </Tooltip>
                        <Tooltip arrow placement="right" title="Delete">
                            <IconButton color="error" onClick={() => handleDeleteRow(row)}>
                                <Delete />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
                renderTopToolbarCustomActions={() => (
                    <>
                        <Button color="secondary" onClick={() => setCreateModalOpen(true)} variant="contained">
                            Create New Depot
                        </Button>
                        <Tooltip arrow title="Refresh Data">
                            <IconButton onClick={() => refetch()}>
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    </>
                )}
                rowCount={data?.count ?? 0}
                state={{
                    columnFilters,
                    globalFilter,
                    isLoading,
                    pagination,
                    showAlertBanner: isError,
                    showProgressBars: isFetching,
                    sorting
                }}
            />
            <CreateNewAccountModal
                columns={newColumns}
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSubmit={handleCreateNewRow}
            />
        </>
    );
};

//example of creating a mui dialog modal for creating new rows
export const CreateNewAccountModal = ({ open, columns, onClose, onSubmit }) => {
    const [values, setValues] = useState(() =>
        columns.reduce((acc, column) => {
            acc[column.accessorKey ?? ''] = '';
            return acc;
        }, {})
    );

    const handleSubmit = () => {
        //put your validation logic here
        onSubmit(values);
        onClose();
    };

    return (
        <Dialog open={open}>
            <DialogTitle textAlign="center">Create New Account</DialogTitle>
            <DialogContent>
                <form onSubmit={(e) => e.preventDefault()}>
                    <Stack
                        sx={{
                            width: '100%',
                            minWidth: { xs: '300px', sm: '360px', md: '400px' },
                            gap: '1.5rem'
                        }}
                    >
                        {columns.map((column) => (
                            <TextField
                                key={column.accessorKey}
                                label={column.header}
                                name={column.accessorKey}
                                onChange={(e) => setValues({ ...values, [e.target.name]: e.target.value })}
                            />
                        ))}
                    </Stack>
                </form>
            </DialogContent>
            <DialogActions sx={{ p: '1.25rem' }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button color="secondary" onClick={handleSubmit} variant="contained">
                    Create New Depot
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const queryClient = new QueryClient();

const Depots = () => {
    return (
        <MainCard title="Depots">
            <QueryClientProvider client={queryClient}>
                <Example />
            </QueryClientProvider>
            <DataGrid rows={rows} columns={columns} sx={{ height: 300 }} />
        </MainCard>
    );
};

const validateRequired = (value) => !!value.length;
const validateEmail = (email) =>
    !!email.length &&
    email
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
const validateAge = (age) => age >= 18 && age <= 50;

export default Depots;
