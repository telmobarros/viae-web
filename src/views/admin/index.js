// in src/App.tsx
import { addRefreshAuthToDataProvider, fetchUtils, Admin, Resource, ListGuesser, EditGuesser, ShowGuesser } from 'react-admin';
import FABProvider from '../../ra-data-fab/index.ts';

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

const AdminPage = () => (
    <Admin basename="/admin" dataProvider={dataProvider}>
        <Resource name="datasets" list={DatasetList} create={DatasetCreate} edit={DatasetEdit} />
        <Resource name="dataset_instances" list={DatasetInstanceList} create={DatasetInstanceCreate} edit={DatasetInstanceEdit} />
        <Resource name="data_sources" list={DataSourceList} create={DataSourceCreate} edit={DataSourceEdit} />
        <Resource name="depots" list={DepotsList} edit={EditGuesser} />
        <Resource name="accounts" list={AccountList} edit={EditGuesser} />
        <Resource name="nodes" list={ListGuesser} />
    </Admin>
);

export default AdminPage;
