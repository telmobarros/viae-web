import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

// project imports
import MainLayout from 'layout/MainLayout';
import RequireAuth from './RequireAuth';
import Loadable from 'ui-component/Loadable';

// dashboard routing
const DashboardDefault = Loadable(lazy(() => import('views/dashboard/Default')));

// instance related routing
const ProblemInstances = Loadable(lazy(() => import('views/problem-instances')));
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
const LiveSolutions = Loadable(lazy(() => import('views/live/LiveSolutions')));

const Depots = Loadable(lazy(() => import('views/depots')));
const RiskEditor = Loadable(lazy(() => import('views/risk/Edit')));
const RiskModelsPage = Loadable(lazy(() => import('views/risk')));
const RiskModelPage = Loadable(lazy(() => import('views/risk/id')));
const RiskModelVisualization = Loadable(lazy(() => import('views/risk/visualization')));
const RiskCollectionPage = Loadable(lazy(() => import('views/risk/collections/id')));
const IndicatorsPage = Loadable(lazy(() => import('views/risk/indicators')));
const ExplorationPage = Loadable(lazy(() => import('views/admin/Exploration')));
// The DataSource integration workflow now lives in the admin back-office
// (views/admin/index.js registers it as a react-admin CustomRoute at
// /admin/data-sources, with its own dataset-instance picker since the admin
// layout has no header instance-selector).

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
            path: 'problem-instances',
            element: <ProblemInstances />
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
            path: 'live/solutions',
            element: <LiveSolutions />
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
            path: 'depots',
            element: <Depots />
        },
        {
            path: 'risk-editor',
            element: <RiskEditor />
        },
        {
            path: 'risk',
            element: <RiskModelsPage />
        },
        {
            path: 'risk/:id',
            element: <RiskModelPage />
        },
        {
            path: 'risk/:id/view',
            element: <RiskModelVisualization />
        },
        {
            path: 'risk/collections/:id',
            element: <RiskCollectionPage />
        },
        {
            path: 'risk/indicators',
            element: <IndicatorsPage />
        },
        {
            path: 'admin/exploration',
            element: <ExplorationPage />
        },
        {
            // The page moved into the admin back-office. There is no catch-all
            // route in this app, so an unmatched path renders nothing at all —
            // leaving the old URL undefined would just show a blank screen to
            // anyone with a bookmark. Redirect instead.
            path: 'data-sources',
            element: <Navigate to="/admin/data-sources" replace />
        }
    ]
};

export default MainRoutes;
