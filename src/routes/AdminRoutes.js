import { lazy } from 'react';

// project imports
import Loadable from 'ui-component/Loadable';
import MinimalLayout from 'layout/MinimalLayout';
import RequireAuth from './RequireAuth';

// admin routing
const Admin = Loadable(lazy(() => import('views/admin')));

// ==============================|| AUTHENTICATION ROUTING ||============================== //

const AdminRoutes = {
    path: '/admin/*',
    element: (
        <RequireAuth>
            <Admin />
        </RequireAuth>
    ),
    children: [
        {
            path: 'depots/:id?/:action?',
            element: <Admin />
        },
        {
            path: 'accounts/:id?/:action?',
            element: <Admin />
        },
        {
            path: 'datasets/:id?/:action?',
            element: <Admin />
        },
        {
            path: 'dataset_instances/:id?/:action?',
            element: <Admin />
        },
        {
            path: 'data_sources/:id?/:action?',
            element: <Admin />
        }
    ]
};

export default AdminRoutes;
