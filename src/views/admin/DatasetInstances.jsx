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

export const DatasetInstanceCreate = () => (
    <Create>
        <DatasetInstanceForm />
    </Create>
);

export const DatasetInstanceEdit = () => (
    <Edit>
        <DatasetInstanceForm />
    </Edit>
);
