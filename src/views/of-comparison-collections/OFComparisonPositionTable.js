import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';

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

const OFComparisonPositionTable = ({ ofComparisonCollectionId }) => {
    const navigate = useNavigate();
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
    const [sorting, setSorting] = useState([{ id: 'position', desc: false }]);
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
                id: 'position',
                accessorKey: 'position',
                header: 'Pos.',
                size: 100,
                ...alignCenterPx0
            },
            {
                id: 'solution_id',
                accessorKey: 'solution_id',
                header: 'Solution ID',
                size: 100,
                ...alignCenterPx0
            },
            { id: 'solution.cost', accessorKey: 'solution.cost', header: 'Cost', size: 10 },
            { id: 'solution.feasibility', accessorKey: 'solution.feasibility', header: 'Feasibility', size: 10 },
            {
                id: 'score',
                accessorKey: 'score',
                header: 'Score',
                size: 10,
                ...alignCenterPx0,
                Cell: ({ renderedCellValue }) => {
                    const number = parseFloat(renderedCellValue);
                    return isNaN(number) ? null : number;
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
                const response = await authAxios.get('http://localhost:5000/api/v1/of_comparison_positions/', {
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
            positionActionsColumn="last"
            enableColumnDragging={false}
            enableGlobalFilter={false}
            enableColumnFilters={false}
            enableColumnActions={false}
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
        />
    );
};

export default OFComparisonPositionTable;
