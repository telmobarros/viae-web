import {
    List,
    Datagrid,
    TextField,
    BooleanField,
    ReferenceField,
    Create,
    Edit,
    SimpleForm,
    TextInput,
    BooleanInput,
    ReferenceInput,
    SelectInput,
    NumberInput
} from 'react-admin';

const distanceChoices = [
    { id: 'euclidean', name: 'Euclidean' },
    { id: 'manhattan', name: 'Manhattan' },
    { id: 'haversine', name: 'Haversine' }
];

const roundingChoices = [
    { id: 'ceil', name: 'Ceil' },
    { id: 'floor', name: 'Floor' },
    { id: 'decimals', name: 'Decimals' }
];

export const DatasetInstanceList = () => (
    <List sort={{ field: 'id', order: 'ASC' }}>
        <Datagrid rowClick="edit">
            <TextField source="id" />
            <TextField source="name" />
            <ReferenceField label="Dataset" source="dataset_id" reference="datasets">
                <TextField source="name" />
            </ReferenceField>
            <BooleanField source="synthetic" />
            <TextField source="distance_type" label="Distance" />
        </Datagrid>
    </List>
);

const DatasetInstanceForm = () => (
    <SimpleForm>
        <ReferenceInput source="dataset_id" reference="datasets" required>
            <SelectInput optionText="name" />
        </ReferenceInput>
        <TextInput source="name" required />
        <BooleanInput source="synthetic" />
        <SelectInput source="distance_type" choices={distanceChoices} label="Distance type" />
        <SelectInput source="rounding_rule" choices={roundingChoices} allowEmpty label="Rounding rule" />
        <NumberInput source="decimals" />
        <BooleanInput source="symmetric" />
    </SimpleForm>
);

/**
 * A react-admin form is initialised from the whole record and submits the
 * whole record back, so a PUT carries every field the API returned — not just
 * the ones touched. `default_data_source_id` is one of those: it is
 * provisioning state (it points at the instance's own local database, written
 * server-side when the instance is provisioned), so the API deliberately does
 * not accept it on edit and rejects the PUT with "Unknown field."
 *
 * Sending exactly the editable contract keeps that rejection from blocking
 * unrelated edits — changing the distance type, for instance. The list must
 * stay in step with DATASET_INSTANCE_EDITABLE_COLUMNS in
 * viae/app/utils/admin_contracts.py.
 */
const EDITABLE_FIELDS = [
    'name',
    'synthetic',
    'symmetric',
    'distance_type',
    'rounding_rule',
    'decimals',
    'dataset_id',
    'problem_variant_id'
];

const onlyEditableFields = (data) => Object.fromEntries(Object.entries(data).filter(([key]) => EDITABLE_FIELDS.includes(key)));

export const DatasetInstanceCreate = () => (
    <Create transform={onlyEditableFields}>
        <DatasetInstanceForm />
    </Create>
);

export const DatasetInstanceEdit = () => (
    <Edit transform={onlyEditableFields}>
        <DatasetInstanceForm />
    </Edit>
);
