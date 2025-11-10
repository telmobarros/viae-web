import React, { useContext, useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import AuthContext from 'contexts/AuthContext';

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
    Typography,
    MenuItem,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { DeleteOutlined, EditOutlined, Compare } from '@mui/icons-material';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import authAxios from 'utils/axios';

const OFComparisonTable = ({ ofComparisonCollectionId }) => {
    const navigate = useNavigate();
    const theme = useTheme();
    const { user } = useContext(AuthContext);
    console.log(user);
    const { enqueueSnackbar } = useSnackbar();
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowSelection, setRowSelection] = useState({});
    const [rowCount, setRowCount] = useState(0);
    const [selectedInstances, setSelectedInstances] = useState([]);
    const tableRef = useRef(null);

    //table state
    const [columnFilters, setColumnFilters] = useState([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([{ id: 'id', desc: true }]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10
    });
    const alignCenterPx0 = {
        muiTableHeadCellProps: { align: 'center', sx: { px: 1 } },
        muiTableBodyCellProps: { align: 'center', sx: { px: 1 } }
    };

    const columns = useMemo(
        () => [
            {
                id: 'id',
                accessorKey: 'id',
                header: 'ID',
                size: 100,
                ...alignCenterPx0
            },
            {
                id: 'solution_id_1',
                accessorKey: 'solution_id_1',
                header: 'Solution A',
                size: 100,
                ...alignCenterPx0,
                muiTableBodyCellProps: ({ cell }) => ({
                    ...alignCenterPx0.muiTableBodyCellProps,
                    sx: {
                        ...alignCenterPx0.muiTableBodyCellProps.sx,
                        backgroundColor: cell.row.original.preferred === false ? theme.palette.secondary.light : 'inherit',
                        fontWeight: cell.row.original.preferred === false ? 'bold' : 'inherit'
                    }
                })
            },
            {
                id: 'solution_id_2',
                accessorKey: 'solution_id_2',
                header: 'Solution B',
                size: 100,
                ...alignCenterPx0,
                muiTableBodyCellProps: ({ cell }) => ({
                    ...alignCenterPx0.muiTableBodyCellProps,
                    sx: {
                        ...alignCenterPx0.muiTableBodyCellProps.sx,
                        backgroundColor: cell.row.original.preferred === true ? theme.palette.secondary.light : 'inherit',
                        fontWeight: cell.row.original.preferred === true ? 'bold' : 'inherit'
                    }
                })
            },
            { id: 'user', accessorKey: 'user', header: 'User' },
            {
                id: 'preferred',
                accessorKey: 'preferred',
                header: 'Preferred',
                enableColumnFilter: false,
                Cell: ({ cell }) => {
                    return cell.getValue() === false ? 'Sol. A' : cell.getValue() === true ? 'Sol. B' : '-';
                }
            },
            {
                id: 'is_conflicting',
                accessorKey: 'is_conflicting',
                header: 'Conflicting?',
                filterVariant: 'checkbox',
                Cell: ({ cell }) => {
                    return cell.getValue() === true ? 'Yes' : 'No';
                }
            },
            {
                id: 'updated_at',
                accessorKey: 'updated_at',
                header: 'Last update',
                size: 60,
                Cell: ({ renderedCellValue }) => {
                    const date = new Date(renderedCellValue);
                    const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
                    const formattedDate = date.toLocaleString('pt-PT', options);
                    return formattedDate;
                },
                enableColumnFilter: false
            }
        ],
        []
    );

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                setIsRefetching(true);
                const response = await authAxios.get('http://localhost:5000/api/v1/of_comparisons/', {
                    params: {
                        q: {
                            page: pagination.pageIndex,
                            page_size: pagination.pageSize,
                            order_column: sorting[0]?.id,
                            order_direction: sorting[0]?.desc ? 'desc' : 'asc',
                            filters: [
                                {
                                    col: 'of_comparison_collection',
                                    opr: 'rel_o_m',
                                    value: ofComparisonCollectionId
                                }
                            ]
                        }
                    }
                });
                setRowCount(response.data.count);
                setData(response.data.result);
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

        fetchData();
    }, [columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, enqueueSnackbar]);

    useEffect(() => {
        const selected = Object.keys(rowSelection).map((index) => data[parseInt(index, 10)]);
        setSelectedInstances(selected);
    }, [rowSelection, data]);

    return (
        <MaterialReactTable
            positionToolbarAlertBanner={'none'}
            columns={columns}
            data={data}
            enableColumnDragging={false}
            enableGlobalFilter={false}
            enableColumnFilters={false}
            positionActionsColumn="last"
            enableColumnActions={false}
            enableRowActions
            enableStickyHeader
            autoResetPageIndex={false} // automatically reset the table back to the first page whenever sorting, filtering, or grouping occurs
            manualFiltering={true}
            manualPagination={true}
            manualSorting={true}
            onSortingChange={setSorting}
            onPaginationChange={setPagination}
            rowCount={rowCount}
            initialState={{
                sorting: sorting,
                density: 'compact'
            }}
            state={{
                isLoading,
                pagination,
                sorting,
                showAlertBanner: isError,
                showProgressBars: isRefetching
            }}
            tableInstanceRef={tableRef}
            displayColumnDefOptions={{ 'mrt-row-actions': { header: '' } }}
            renderRowActionMenuItems={({ row }) => {
                console.log(user);
                return [
                    <MenuItem key="edit" onClick={() => handleEdit(row)} disabled={row.original.user !== user.sub ? true : false}>
                        <ListItemIcon>
                            <EditOutlined fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Editar</ListItemText>
                    </MenuItem>,
                    <MenuItem key="delete" onClick={() => handleDelete(row)} disabled={row.original.user !== user.sub ? true : false}>
                        <ListItemIcon>
                            <DeleteOutlined fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Apagar</ListItemText>
                    </MenuItem>
                ];
            }}
        />
    );
};

export default OFComparisonTable;
