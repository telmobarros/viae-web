import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MaterialReactTable } from 'material-react-table';
import { useSnackbar } from 'notistack';
import authAxios from 'utils/axios';

const RiskCollectionPositionTable = ({ collectionId }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const tableRef = useRef(null);

    const [sorting, setSorting] = useState([{ id: 'position', desc: false }]);
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

    const alignCenter = {
        muiTableHeadCellProps: { align: 'center', sx: { px: 1 } },
        muiTableBodyCellProps: { align: 'center', sx: { px: 1 } }
    };

    const columns = useMemo(
        () => [
            { id: 'position', accessorKey: 'position', header: 'Rank', size: 80, ...alignCenter },
            { id: 'node_id', accessorKey: 'node_id', header: 'Node ID', size: 90, ...alignCenter },
            {
                id: 'score',
                accessorKey: 'score',
                header: 'Copeland Score',
                size: 130,
                ...alignCenter,
                Cell: ({ cell }) => (cell.getValue() != null ? Number(cell.getValue()).toFixed(3) : '—')
            }
        ],
        []
    );

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                setIsRefetching(true);
                const response = await authAxios.get('http://localhost:5000/api/v1/risk_collection_positions/', {
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
            } catch (error) {
                setIsError(true);
                enqueueSnackbar('Error fetching ranking', { variant: 'error' });
            } finally {
                setIsLoading(false);
                setIsRefetching(false);
            }
        };
        fetchData();
    }, [collectionId, pagination.pageIndex, pagination.pageSize, sorting, enqueueSnackbar]);

    return (
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
        />
    );
};

export default RiskCollectionPositionTable;
