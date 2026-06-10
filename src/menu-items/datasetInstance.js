// assets
import { IconDashboard, IconKey, IconTargetArrow, IconListCheck } from '@tabler/icons';

// constant
const icons = { IconDashboard, IconKey, IconTargetArrow, IconListCheck };

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
        }
    ]
};

export default datasetInstance;
