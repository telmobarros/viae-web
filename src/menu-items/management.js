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
            id: 'live',
            title: 'Live',
            type: 'collapse',
            icon: icons.IconBuilding,
            children: [
                {
                    id: 'live-map',
                    title: 'Live Map',
                    type: 'item',
                    url: '/live',
                    breadcrumbs: false
                },
                {
                    id: 'live-solutions',
                    title: 'Live Solutions',
                    type: 'item',
                    url: '/live/solutions',
                    breadcrumbs: false
                }
            ]
        }
    ]
};

export default management;
