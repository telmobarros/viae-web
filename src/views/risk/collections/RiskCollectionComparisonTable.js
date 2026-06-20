import React, { useContext, useEffect, useState, useMemo, useRef } from 'react';
import { Button, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DeleteOutlined, EditOutlined } from '@mui/icons-material';
import { MaterialReactTable } from 'material-react-table';
import { useSnackbar } from 'notistack';

import AuthContext from 'contexts/AuthContext';
import authAxios from 'utils/axios';
import ComparisonDialog from './ComparisonDialog';

const RiskCollectionClassificationTable = ({ collectionId, refreshKey = 0 }) => {
    const theme = useTheme();
    const { enqueueSnackbar } = useSnackbar();
    const { username: currentUsername } = useContext(AuthContext);

    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const [localRefresh, setLocalRefresh] = useState(0);
    const tableRef = useRef(null);

    const [editComparisonId, setEditComparisonId] = useState(null);

    const [sorting, setSorting] = useState([{ id: 'id', desc: true }]);
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

    const alignCenter = {
        muiTableHeadCellProps: { align: 'center', sx: { px: 1 } },
        muiTableBodyCellProps: { align: 'center', sx: { px: 1 } }
    };

    const columns = useMemo(
        () => [
            { id: 'id', accessorKey: 'id', header: 'ID', size: 80, ...alignCenter },
            {
                id: 'node_id_1',
                accessorKey: 'node_id_1',
                header: 'Node A',
                size: 90,
                ...alignCenter,
                muiTableBodyCellProps: ({ cell }) => ({
                    ...alignCenter.muiTableBodyCellProps,
                    sx: {
                        ...alignCenter.muiTableBodyCellProps.sx,
                        backgroundColor: cell.row.original.higher_risk === false ? theme.palette.secondary.light : 'inherit',
                        fontWeight: cell.row.original.higher_risk === false ? 'bold' : 'inherit'
                    }
                })
            },
            {
                id: 'node_id_2',
                accessorKey: 'node_id_2',
                header: 'Node B',
                size: 90,
                ...alignCenter,
                muiTableBodyCellProps: ({ cell }) => ({
                    ...alignCenter.muiTableBodyCellProps,
                    sx: {
                        ...alignCenter.muiTableBodyCellProps.sx,
                        backgroundColor: cell.row.original.higher_risk === true ? theme.palette.secondary.light : 'inherit',
                        fontWeight: cell.row.original.higher_risk === true ? 'bold' : 'inherit'
                    }
                })
            },
            { id: 'user', accessorKey: 'user', header: 'User' },
            {
                id: 'higher_risk',
                accessorKey: 'higher_risk',
                header: 'Higher Risk',
                ...alignCenter,
                Cell: ({ cell }) => (cell.getValue() === false ? 'Node A' : cell.getValue() === true ? 'Node B' : '—')
            },
            {
                id: 'is_conflicting',
                accessorKey: 'is_conflicting',
                header: 'Conflicting?',
                ...alignCenter,
                Cell: ({ cell }) => (cell.getValue() === true ? 'Yes' : 'No')
            },
            {
                id: 'updated_at',
                accessorKey: 'updated_at',
                header: 'Last update',
                size: 60,
                enableColumnFilter: false,
                Cell: ({ renderedCellValue }) => {
                    if (!renderedCellValue) return '—';
                    return new Date(renderedCellValue).toLocaleString('pt-PT', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }
        ],
        [theme]
    );

    const fetchData = async () => {
        setIsLoading(true);
        try {
            setIsRefetching(true);
            const response = await authAxios.get('http://localhost:5000/api/v1/risk_comparisons/', {
                params: {
                    q: {
                        page: pagination.pageIndex,
                        page_size: pagination.pageSize,
                        order_column: sorting[0]?.id,
                        order_direction: sorting[0]?.desc ? 'desc' : 'asc',
                        filters: [{ col: 'collection_id', opr: 'eq', value: collectionId }]
                    }
                }
            });
            setRowCount(response.data.count);
            setData(response.data.result);
            setIsError(false);
        } catch {
            setIsError(true);
            enqueueSnackbar('Error fetching comparisons', { variant: 'error' });
        } finally {
            setIsLoading(false);
            setIsRefetching(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [collectionId, refreshKey, localRefresh, pagination.pageIndex, pagination.pageSize, sorting]);

    const handleDelete = async (row) => {
        if (!window.confirm('Delete this comparison?')) return;
        try {
            await authAxios.delete(`http://localhost:5000/api/v1/risk_comparisons/${row.original.id}`);
            enqueueSnackbar('Deleted', { variant: 'success' });
            setLocalRefresh((k) => k + 1);
        } catch {
            enqueueSnackbar('Delete failed', { variant: 'error' });
        }
    };

    return (
        <>
            <MaterialReactTable
                positionToolbarAlertBanner="none"
                columns={columns}
                data={data}
                enableColumnDragging={false}
                enableGlobalFilter={false}
                enableColumnFilters={false}
                enableColumnActions={false}
                enableStickyHeader
                autoResetPageIndex={false}
                manualFiltering
                manualPagination
                manualSorting
                onSortingChange={setSorting}
                onPaginationChange={setPagination}
                rowCount={rowCount}
                initialState={{ sorting, density: 'compact' }}
                state={{ isLoading, pagination, sorting, showAlertBanner: isError, showProgressBars: isRefetching }}
                tableInstanceRef={tableRef}
                positionActionsColumn="last"
                enableRowActions
                displayColumnDefOptions={{ 'mrt-row-actions': { header: '' } }}
                renderRowActionMenuItems={({ row }) => [
                    <MenuItem
                        key="edit"
                        onClick={() => setEditComparisonId(row.original.id)}
                        disabled={!currentUsername || row.original.user !== currentUsername}
                    >
                        <ListItemIcon>
                            <EditOutlined fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Edit</ListItemText>
                    </MenuItem>,
                    <MenuItem
                        key="delete"
                        onClick={() => handleDelete(row)}
                        disabled={!currentUsername || row.original.user !== currentUsername}
                    >
                        <ListItemIcon>
                            <DeleteOutlined fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Delete</ListItemText>
                    </MenuItem>
                ]}
            />

            <ComparisonDialog
                open={editComparisonId != null}
                onClose={() => {
                    setEditComparisonId(null);
                    setLocalRefresh((k) => k + 1);
                }}
                collectionId={collectionId}
                editComparisonId={editComparisonId}
            />
        </>
    );
};

export default RiskCollectionClassificationTable;
