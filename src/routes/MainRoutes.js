import { lazy } from 'react';

// project imports
import MainLayout from 'layout/MainLayout';
import Loadable from 'ui-component/Loadable';

// dashboard routing
const DashboardDefault = Loadable(lazy(() => import('views/dashboard/Default')));

// instance related routing
const ObjectiveFunction = Loadable(lazy(() => import('views/objective-function')));
const OFComparisonCollectionPage = Loadable(lazy(() => import('views/of-comparison-collections/id')));
const OFComparisonPage = Loadable(lazy(() => import('views/of-comparisons/id')));
const SolvingMethodology = Loadable(lazy(() => import('views/solving-methodology')));

// utilities routing
const UtilsTypography = Loadable(lazy(() => import('views/utilities/Typography')));
const UtilsColor = Loadable(lazy(() => import('views/utilities/Color')));
const UtilsShadow = Loadable(lazy(() => import('views/utilities/Shadow')));
const UtilsMaterialIcons = Loadable(lazy(() => import('views/utilities/MaterialIcons')));
const UtilsTablerIcons = Loadable(lazy(() => import('views/utilities/TablerIcons')));

// sample page routing
const SamplePage = Loadable(lazy(() => import('views/sample-page')));
const Depots = Loadable(lazy(() => import('views/depots')));
const RiskEditor = Loadable(lazy(() => import('views/risk/Edit')));

// ==============================|| MAIN ROUTING ||============================== //

const MainRoutes = {
    path: '/',
    element: <MainLayout />,
    children: [
        {
            path: '/',
            element: <DashboardDefault />
        },
        {
            path: 'dashboard',
            children: [
                {
                    path: 'default',
                    element: <DashboardDefault />
                }
            ]
        },
        {
            path: 'objective-function',
            element: <ObjectiveFunction />
        },
        {
            path: 'solving-methodology',
            element: <SolvingMethodology />
        },
        {
            path: 'of-comparison-collections/:id',
            element: <OFComparisonCollectionPage />
        },
        {
            path: 'of-comparisons/:id',
            element: <OFComparisonPage />
        },
        {
            path: 'utils',
            children: [
                {
                    path: 'util-typography',
                    element: <UtilsTypography />
                }
            ]
        },
        {
            path: 'utils',
            children: [
                {
                    path: 'util-color',
                    element: <UtilsColor />
                }
            ]
        },
        {
            path: 'utils',
            children: [
                {
                    path: 'util-shadow',
                    element: <UtilsShadow />
                }
            ]
        },
        {
            path: 'icons',
            children: [
                {
                    path: 'tabler-icons',
                    element: <UtilsTablerIcons />
                }
            ]
        },
        {
            path: 'icons',
            children: [
                {
                    path: 'material-icons',
                    element: <UtilsMaterialIcons />
                }
            ]
        },
        {
            path: 'sample-page',
            element: <SamplePage />
        },
        {
            path: 'depots',
            element: <Depots />
        },
        {
            path: 'risk-editor',
            element: <RiskEditor />
        }
    ]
};

export default MainRoutes;
