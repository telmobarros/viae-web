import {
    List,
    Datagrid,
    TextField,
    ReferenceField,
    Create,
    Edit,
    SimpleForm,
    TextInput,
    ReferenceInput,
    SelectInput,
    NumberInput
} from 'react-admin';

const driverChoices = [
    { id: 'postgresql', name: 'PostgreSQL' },
    { id: 'mysql', name: 'MySQL' },
    { id: 'sqlite', name: 'SQLite' },
    { id: 'mssql', name: 'SQL Server' }
];

export const DataSourceList = () => (
    <List sort={{ field: 'id', order: 'ASC' }}>
        <Datagrid rowClick="edit">
            <TextField source="id" />
            <ReferenceField label="Dataset Instance" source="dataset_instance_id" reference="dataset_instances">
                <TextField source="name" />
            </ReferenceField>
            <TextField source="driver_name" label="Driver" />
            <TextField source="database" />
            <TextField source="host" />
            <TextField source="port" />
        </Datagrid>
    </List>
);

const DataSourceForm = () => (
    <SimpleForm>
        <ReferenceInput source="dataset_instance_id" reference="dataset_instances" required label="Dataset Instance">
            <SelectInput optionText="name" />
        </ReferenceInput>
        <SelectInput source="driver_name" choices={driverChoices} label="Driver" required />
        <TextInput source="host" />
        <NumberInput source="port" />
        <TextInput source="database" required />
        <TextInput source="user" />
        <TextInput source="password" type="password" />
    </SimpleForm>
);

export const DataSourceCreate = () => (
    <Create>
        <DataSourceForm />
    </Create>
);

export const DataSourceEdit = () => (
    <Edit>
        <DataSourceForm />
    </Edit>
);
