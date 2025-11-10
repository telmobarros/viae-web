import { Datagrid, DateField, EmailField, List, TextField } from 'react-admin';

export const AccountList = () => (
    <List>
        <Datagrid rowClick="edit">
            <TextField source="id" sortable={false} />
            <DateField source="created_on" />
            <EmailField source="email" />
            <DateField source="last_login" />
            <TextField source="password" />
            <TextField source="username" />
        </Datagrid>
    </List>
);
