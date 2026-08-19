/**
 * Read-only browsing of a DatasetInstance's own canonical entities.
 *
 * These live in the per-instance SQLite database rather than the meta DB, so
 * they are served by hand-written list endpoints (`/api/v1/nodes`,
 * `/api/v1/vehicle_profiles` in app/views.py) that answer in the envelope
 * ra-data-fab already expects. That lets them be ordinary react-admin
 * resources: pagination, ordering and the row count all come from <List>
 * for free, which matters because a synced ASAE instance holds millions of
 * nodes and must never be loaded in one go.
 *
 * Scoping is by permanent filter rather than by URL: the endpoints require a
 * `dataset_instance_id` filter, which is what <List filter={...}> sends. The
 * instance comes from the same Redux selection the main site uses, now shown
 * in the admin's own top bar (see views/admin/index.js).
 *
 * Read-only on purpose. Editing would have to honour the field-ownership
 * contract (an externally-mapped field must not be hand-edited, since the
 * next sync would overwrite it) and route Node coordinates through the
 * geography writer that keeps latitude/longitude/gps_location consistent.
 */
import { useSelector } from 'react-redux';
import { Alert } from '@mui/material';
import { BooleanField, Datagrid, List, NumberField, TextField } from 'react-admin';

const NoInstanceSelected = ({ what }) => (
    <Alert severity="info" sx={{ m: 2 }}>
        Select a dataset instance in the top bar to browse its {what}.
    </Alert>
);

/** Shared shape: instance-scoped, read-only, server-paginated. */
const InstanceList = ({ children, ...props }) => {
    const instance = useSelector((state) => state.instance.instance);
    if (!instance?.id) return <NoInstanceSelected what={props.entityLabel} />;
    return (
        <List
            {...props}
            // Re-mount when the selected instance changes so react-admin drops
            // the previous instance's cached page rather than showing it under
            // the new heading.
            key={instance.id}
            filter={{ dataset_instance_id: instance.id }}
            sort={{ field: 'id', order: 'ASC' }}
            exporter={false}
            actions={false}
        >
            <Datagrid bulkActionButtons={false} rowClick={false}>
                {children}
            </Datagrid>
        </List>
    );
};

export const NodeList = () => (
    <InstanceList entityLabel="nodes" title="Nodes">
        <NumberField source="id" />
        <NumberField source="type" label="Type (0=depot, 1=customer, 2=station)" />
        <TextField source="custom" label="Custom" />
        <BooleanField source="trailer" label="Trailer" />
        <NumberField source="latitude" />
        <NumberField source="longitude" />
    </InstanceList>
);

export const VehicleProfileList = () => (
    <InstanceList entityLabel="vehicle profiles" title="Vehicle Profiles">
        <NumberField source="id" />
        <NumberField source="number" label="Fleet size" />
        <TextField source="custom" label="Custom" />
        <NumberField source="fuel_tank_capacity" label="Fuel tank" />
        <NumberField source="fuel_consumption_rate" label="Consumption" />
        <NumberField source="max_travel_distance" label="Max distance" />
        <NumberField source="max_travel_time" label="Max time" />
    </InstanceList>
);
