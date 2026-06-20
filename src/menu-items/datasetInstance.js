// assets
import { IconDashboard, IconKey, IconTargetArrow, IconListCheck, IconShieldCheck, IconDatabase, IconFlask } from '@tabler/icons';

// constant
const icons = { IconDashboard, IconKey, IconTargetArrow, IconListCheck, IconShieldCheck, IconDatabase, IconFlask };

// ==============================|| DASHBOARD MENU ITEMS ||============================== //

const datasetInstance = {
    id: 'datasetInstance',
    title: 'Instance',
    type: 'group',
    children: [
        {
            id: 'dashboard',
            title: 'Dashboard',
            type: 'item',
            url: '/dashboard/default',
            icon: icons.IconDashboard,
            breadcrumbs: false
        },
        {
            id: 'objectiveFunction',
            title: 'Objective Function',
            type: 'item',
            url: '/objective-function',
            icon: icons.IconTargetArrow,
            breadcrumbs: true
        },

        {
            id: 'solvingMethodology',
            title: 'Solving Method',
            type: 'item',
            url: '/solving-methodology',
            icon: icons.IconKey,
            breadcrumbs: true
        },
        {
            id: 'solverExecutions',
            title: 'Solver Executions',
            type: 'item',
            url: '/solver-executions',
            icon: icons.IconListCheck,
            breadcrumbs: true
        },
        {
            id: 'exploration',
            title: 'Exploration',
            type: 'item',
            url: '/admin/exploration',
            icon: icons.IconFlask,
            breadcrumbs: true
        },
        {
            id: 'risk',
            title: 'Risk',
            type: 'collapse',
            icon: icons.IconShieldCheck,
            children: [
                {
                    id: 'riskModels',
                    title: 'Risk Models',
                    type: 'item',
                    url: '/risk',
                    breadcrumbs: true
                },
                {
                    id: 'riskIndicators',
                    title: 'Indicator Catalogue',
                    type: 'item',
                    url: '/risk/indicators',
                    breadcrumbs: true
                }
            ]
        }
    ]
};

export default datasetInstance;
