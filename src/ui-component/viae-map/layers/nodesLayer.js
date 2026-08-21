/**
 * Node scatterplot layer, shared by every ViaeMap consumer.
 *
 * The styling logic lives in ./nodeStyle.js, split out because it has no
 * deck.gl import and this file does -- see nodeStyle.js for why that split
 * matters for testability here.
 */
import { ScatterplotLayer } from '@deck.gl/layers';

import { colorFor, radiusPropsFor, selectionOutlineColor } from './nodeStyle';

export { colorFor, radiusPropsFor, selectionOutlineColor };

/**
 * @param {Object} params
 * @param {import('../model').VNode[]} params.nodes
 * @param {'geo'|'plane2d'|'plane3d'} params.spaceMode
 * @param {number|string|null} [params.hoveredId]
 * @param {number|string|null} [params.selectedId]
 * @param {'light'|'dark'} [params.themeMode]
 * @param {(info: Object) => void} [params.onHover]
 * @param {(info: Object) => void} [params.onClick]
 */
export function buildNodesLayer({ nodes, spaceMode, hoveredId = null, selectedId = null, themeMode = 'light', onHover, onClick }) {
    const outlineColor = selectionOutlineColor(themeMode);
    return new ScatterplotLayer({
        id: 'viae-map-nodes',
        data: nodes,
        pickable: true,
        ...radiusPropsFor(spaceMode),
        stroked: true,
        getLineColor: (n) => (n.id === selectedId ? outlineColor : [0, 0, 0, 0]),
        lineWidthMinPixels: 3,
        getPosition: (n) => n.pos,
        getFillColor: (n) => colorFor(n, hoveredId, selectedId),
        updateTriggers: {
            getFillColor: [hoveredId, selectedId],
            getLineColor: [selectedId]
        },
        onHover,
        onClick
    });
}
