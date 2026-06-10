// assets
import { IconBuilding } from '@tabler/icons';

// constant
const icons = {
    IconBuilding
};

// ==============================|| MANAGEMENT MENU ITEMS ||============================== //

const management = {
    id: 'management',
    title: 'Management',
    type: 'group',
    children: [
        {
            id: 'depots',
            title: 'Depots',
            type: 'item',
            url: '/depots',
            icon: icons.IconBuilding,
            breadcrumbs: false
        },
        {
            id: 'risk',
            title: 'Risk Editor',
            type: 'item',
            url: '/risk-editor',
            icon: icons.IconBuilding,
            breadcrumbs: false
        },
        {
            id: 'live-routes',
            title: 'Live Routes',
            type: 'item',
            url: '/live',
            icon: icons.IconBuilding,
            breadcrumbs: false
        }
    ]
};

export default management;
