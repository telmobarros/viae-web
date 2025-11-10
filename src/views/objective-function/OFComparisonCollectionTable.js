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

const OFComparisonCollectionTable = ({ isOpen, problemInstanceId, onClose, setSelected }) => {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowSelection, setRowSelection] = useState({});
    const [rowCount, setRowCount] = useState(0);
    const [selectedOFComparisonCollection, setSelectedOFComparisonCollection] = useState(null);
    const tableRef = useRef(null);

    //table state
    const [columnFilters, setColumnFilters] = useState([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10
    });

    const columns = useMemo(
        () => [
            {
                id: 'id',
                accessorKey: 'id',
                header: 'ID',
                size: 100
            },
            {
                id: 'name',
                accessorKey: 'name',
                header: 'Name',
                size: 100,
                Cell: ({ cell }) => {
                    const { name, description } = cell.row.original;
                    return (
                        <div>
                            <Tooltip title={description}>
                                <span>{name}</span>
                            </Tooltip>
                        </div>
                    );
                }
            },
            { id: 'n_comparisons', accessorKey: 'n_comparisons', header: '# Comparisons', size: 10 },
            { id: 'n_conflicts', accessorKey: 'n_conflicts', header: '# Conflict', size: 10 },
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
                const response = await authAxios.get('http://localhost:5000/api/v1/of_comparison_collections/', {
                    params: {
                        q: {
                            page: pagination.pageIndex,
                            page_size: pagination.pageSize,
                            order_column: sorting[0]?.id,
                            order_direction: sorting[0]?.desc ? 'desc' : 'asc',
                            filters: [
                                {
                                    col: 'problem_instance',
                                    opr: 'rel_o_m',
                                    value: problemInstanceId
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

        if (isOpen) {
            fetchData();
        }
    }, [columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, isOpen, enqueueSnackbar, problemInstanceId]);

    useEffect(() => {
        const selected = Object.keys(rowSelection).map((index) => data[parseInt(index, 10)]);
        setSelectedOFComparisonCollection(selected);
        setSelected(selected[0]);
    }, [rowSelection, data]);

    return (
        <MaterialReactTable
            positionToolbarAlertBanner={'none'}
            positionExpandColumn="first"
            columns={columns}
            data={data}
            positionActionsColumn="last"
            enableColumnDragging={false}
            enableGlobalFilter={false}
            enableColumnActions={false}
            enableStickyHeader
            autoResetPageIndex={false} // automatically reset the table back to the first page whenever sorting, filtering, or grouping occurs
            paginateExpandedRows={false} // keep expanded sub rows with their parent row on the same page
            enableRowSelection
            enableMultiRowSelection={false}
            manualFiltering={true}
            manualPagination={true}
            manualSorting={true}
            onRowSelectionChange={setRowSelection}
            onSortingChange={setSorting}
            onPaginationChange={setPagination}
            rowCount={rowCount}
            initialState={{
                density: 'compact'
            }}
            state={{
                isLoading,
                pagination,
                sorting,
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
            muiTableBodyRowProps={({ row }) => ({
                onClick: (event) => {
                    navigate(`/of-comparison-collections/${row.original.id}`);
                },
                sx: {
                    cursor: 'pointer' // pointer cursor on hover
                }
            })}
        />
    );
};

export default OFComparisonCollectionTable;
