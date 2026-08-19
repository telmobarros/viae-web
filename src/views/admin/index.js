// in src/App.tsx
import {
    addRefreshAuthToDataProvider,
    fetchUtils,
    Admin,
    AppBar,
    CustomRoutes,
    Layout,
    Logout,
    Menu,
    Resource,
    TitlePortal,
    UserMenu,
    ListGuesser,
    EditGuesser,
    ShowGuesser
} from 'react-admin';
import { Route } from 'react-router-dom';
import { Box, Divider, ListItemIcon, ListItemText, MenuItem } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import PlaceIcon from '@mui/icons-material/Place';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FABProvider from '../../ra-data-fab/index.ts';

import DataSourcesPage from '../data-sources';
import { NodeList, VehicleProfileList } from './InstanceEntities';
import AdminInstanceSelector from './AdminInstanceSelector';

import axios from 'axios';
import jwt_decode from 'jwt-decode';

import { DepotsList } from './Depots';
import { AccountList } from './Account';
import { DatasetList, DatasetCreate, DatasetEdit } from './Datasets';
import { DatasetInstanceList, DatasetInstanceCreate, DatasetInstanceEdit } from './DatasetInstances';
import { DataSourceList, DataSourceCreate, DataSourceEdit } from './DataSources';

// adds the access token to the headers of the request
const httpClient = (url, options = {}) => {
    console.log('url', url);
    console.log('options', options);
    let tokensData = JSON.parse(localStorage.getItem('tokens'));
    // add your own headers here
    if (!options.headers) {
        options.headers = new Headers({ Accept: 'application/json' });
    }
    options.headers.set('Authorization', `Bearer ${tokensData.access_token}`);
    // options.headers.set('X-Custom-Header', 'foobar');
    return fetchUtils.fetchJson(url, options).catch((err) => {
        if (err?.status === 401) {
            localStorage.removeItem('tokens');
            const from = window.location.pathname + window.location.search;
            window.location.assign(`/pages/login/login3?from=${encodeURIComponent(from)}`);
        }
        throw err;
    });
};

const baseDataProvider = FABProvider('http://localhost:5000/api/v1', httpClient);

// refresh token function to be passed to the dataProvider to be called when the access token is expired
const refreshAuth = () => {
    const authData = JSON.parse(localStorage.getItem('tokens'));
    if (jwt_decode(authData.access_token).exp < new Date().getTime() / 1000) {
        return axios
            .post(
                'http://localhost:5000/api/v1/security/refresh',
                {},
                {
                    headers: {
                        Authorization: `Bearer ${authData.refresh_token}`
                    }
                }
            )
            .then((apiResponse) => {
                console.log('token refreshed');
                authData.access_token = apiResponse.data.access_token;
                localStorage.setItem('tokens', JSON.stringify(authData));
            })
            .catch((error) => {
                console.log(error);
            });
    }
    console.log('access token still valid');
    return Promise.resolve();
};

const dataProvider = addRefreshAuthToDataProvider(baseDataProvider, refreshAuth);

// The sidebar is split in two. Above the divider: the meta database, which is
// global. Below it: everything scoped to the *currently selected* dataset
// instance -- its external-source mapping and its own canonical entities.
//
// The items are listed explicitly rather than via <Menu.ResourceItems />,
// which renders every registered resource and would put the instance-scoped
// lists above the divider alongside the meta-DB ones.
const AdminMenu = () => (
    <Menu>
        <Menu.ResourceItem name="datasets" />
        <Menu.ResourceItem name="dataset_instances" />
        <Menu.ResourceItem name="data_sources" />
        <Menu.ResourceItem name="depots" />
        <Menu.ResourceItem name="accounts" />

        <Divider sx={{ my: 1 }} />

        <Menu.Item to="/data-sources" primaryText="Data Source Mapping" leftIcon={<StorageIcon />} />
        <Menu.ResourceItem name="nodes" />
        <Menu.ResourceItem name="vehicle_profiles" />
    </Menu>
);

// "Back to VIAE" lives in react-admin's own <UserMenu>, the documented slot
// for app-level actions next to Logout.
//
// It is a plain anchor rather than <MenuItemLink> because the admin router
// runs with basename="/admin": a router link to '/' resolves to '/admin/' and
// would never leave the back-office. An anchor escapes the basename, at the
// cost of a full page load -- acceptable for deliberately exiting the admin.
const AdminUserMenu = () => (
    <UserMenu>
        <MenuItem component="a" href="/">
            <ListItemIcon>
                <ExitToAppIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Back to VIAE</ListItemText>
        </MenuItem>
        <Divider />
        <Logout />
    </UserMenu>
);

// The instance selection is the same Redux state the main site uses, so the
// two are one act rather than parallel notions of "current instance". The
// control itself is admin-sized -- see AdminInstanceSelector for why the
// main header's chip is not reused directly.
const AdminAppBar = () => (
    <AppBar userMenu={<AdminUserMenu />}>
        <TitlePortal />
        <Box sx={{ flex: 1 }} />
        <AdminInstanceSelector />
    </AppBar>
);

const AdminLayout = (props) => <Layout {...props} menu={AdminMenu} appBar={AdminAppBar} />;

const AdminPage = () => (
    <Admin basename="/admin" dataProvider={dataProvider} layout={AdminLayout}>
        <Resource name="datasets" list={DatasetList} create={DatasetCreate} edit={DatasetEdit} />
        <Resource name="dataset_instances" list={DatasetInstanceList} create={DatasetInstanceCreate} edit={DatasetInstanceEdit} />
        <Resource name="data_sources" list={DataSourceList} create={DataSourceCreate} edit={DataSourceEdit} />
        <Resource name="depots" list={DepotsList} edit={EditGuesser} />
        <Resource name="accounts" list={AccountList} edit={EditGuesser} />
        {/* Instance-scoped, read-only. `nodes` previously pointed at
            ListGuesser over an endpoint that did not exist. */}
        <Resource name="nodes" list={NodeList} options={{ label: 'Nodes' }} icon={PlaceIcon} />
        <Resource name="vehicle_profiles" list={VehicleProfileList} options={{ label: 'Vehicle Profiles' }} icon={LocalShippingIcon} />
        <CustomRoutes>
            <Route path="/data-sources" element={<DataSourcesPage />} />
        </CustomRoutes>
    </Admin>
);

export default AdminPage;
