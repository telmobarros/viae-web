import { lazy } from 'react';

// project imports
import MainLayout from 'layout/MainLayout';
import RequireAuth from './RequireAuth';
import Loadable from 'ui-component/Loadable';

// dashboard routing
const DashboardDefault = Loadable(lazy(() => import('views/dashboard/Default')));

// instance related routing
const ObjectiveFunction = Loadable(lazy(() => import('views/objective-function')));
const OFComparisonCollectionPage = Loadable(lazy(() => import('views/of-comparison-collections/id')));
const OFComparisonPage = Loadable(lazy(() => import('views/of-comparisons/id')));
const SolvingMethodology = Loadable(lazy(() => import('views/solving-methodology')));
const VisualizerPage = Loadable(lazy(() => import('views/visualizers')));
const SolutionVisualizerPage = Loadable(lazy(() => import('views/visualizers/SolutionVisualizer')));
const SolverExecutions = Loadable(lazy(() => import('views/solver-executions')));
const SolverExecutionCharts = Loadable(lazy(() => import('views/solver-executions/ExecutionCharts')));

// live routing
const LiveRoutes = Loadable(lazy(() => import('views/live/LiveRoutes')));

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
    element: (
        <RequireAuth>
            <MainLayout />
        </RequireAuth>
    ),
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
            path: 'solver-executions',
            element: <SolverExecutions />
        },
        {
            path: 'solver-executions/charts',
            element: <SolverExecutionCharts />
        },
        {
            path: 'live',
            element: <LiveRoutes />
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
            path: 'visualizer',
            element: <VisualizerPage />
        },
        {
            path: 'visualizer/solution',
            element: <SolutionVisualizerPage />
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
