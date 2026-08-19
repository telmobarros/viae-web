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
    { id: 'mssql', name: 'SQL Server' },
    { id: 'oracle', name: 'Oracle' }
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

/**
 * DS8 (§19): credentials are write-only.
 *
 * The API deliberately no longer returns `user`/`password` in list/show
 * responses, so these inputs always start empty — including when editing an
 * existing source. That is the fix for a real bug, not a cosmetic choice:
 * the API used to return the stored Fernet ciphertext, this form bound it
 * into the password input, and saving sent it back to a hook that encrypted
 * it a second time. `decrypt_data()` then yielded the ciphertext instead of
 * the password, so every later connection for that source failed.
 *
 * Leaving a credential box empty on edit means "keep the stored one"
 * (enforced server-side in utils/security.py:apply_credential_update).
 */
const CREDENTIAL_HELP = 'Leave blank to keep the stored value.';

const DataSourceForm = ({ isEdit = false }) => (
    <SimpleForm>
        <ReferenceInput source="dataset_instance_id" reference="dataset_instances" required label="Dataset Instance">
            <SelectInput optionText="name" />
        </ReferenceInput>
        <SelectInput source="driver_name" choices={driverChoices} label="Driver" required />
        <TextInput source="host" />
        <NumberInput source="port" />
        <TextInput source="database" required />
        <TextInput source="user" autoComplete="off" helperText={isEdit ? CREDENTIAL_HELP : undefined} />
        <TextInput source="password" type="password" autoComplete="new-password" helperText={isEdit ? CREDENTIAL_HELP : undefined} />
    </SimpleForm>
);

export const DataSourceCreate = () => (
    <Create>
        <DataSourceForm />
    </Create>
);

export const DataSourceEdit = () => (
    <Edit>
        <DataSourceForm isEdit />
    </Edit>
);
