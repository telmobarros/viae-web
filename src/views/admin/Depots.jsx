import { List, Datagrid, TextField, DateField, BooleanField, TextInput } from 'react-admin';

const depotsFilters = [<TextInput label="ID" source="id" alwaysOn />, <TextInput label="Name" source="name__ct" defaultValue="test" />];

export const DepotsList = () => (
    <List sort={{ field: 'id', order: 'ASC' }} filters={depotsFilters}>
        <Datagrid rowClick="edit">
            <TextField source="id" />
            <TextField source="name" />
        </Datagrid>
    </List>
);
