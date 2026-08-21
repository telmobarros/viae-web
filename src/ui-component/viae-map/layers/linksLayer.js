/**
 * Underlying network links -- optional, visual context only.
 *
 * Non-pickable deliberately (Phase 5 requirement: links must not dominate
 * route visualization visually OR computationally, and must not compete for
 * clicks with routes/stops/nodes). Only rendered when there is something
 * meaningful to show: `scene.links.status` must actually indicate data
 * (`ok` or `truncated`), not `none`/`not_requested`/`error` -- an empty
 * LineLayer is harmless, but building one is pointless work, and this keeps
 * the "why is nothing drawn" answer discoverable from the status field
 * rather than from an empty layer silently existing.
 */
import { LineLayer } from '@deck.gl/layers';

import { linkColorFor } from './linksStyle';

const RENDERABLE_STATUS = new Set(['ok', 'truncated']);

/**
 * @param {Object} params
 * @param {Object} params.links Scene.links -- {items, status, ...}
 * @param {Map} params.nodeIndex Scene.nodeIndex
 * @param {'light'|'dark'} [params.themeMode]
 * @returns {LineLayer|null}
 */
export function buildLinksLayer({ links, nodeIndex, themeMode = 'light' }) {
    if (!links || !RENDERABLE_STATUS.has(links.status) || !links.items || !links.items.length) return null;

    const rows = [];
    links.items.forEach((lk) => {
        const source = nodeIndex.get(lk.source);
        const target = nodeIndex.get(lk.target);
        // Same discipline as route geometry: a link to a node this Scene
        // cannot place is dropped, never drawn from/to a fallback position.
        if (!source || !target) return;
        rows.push({ sourcePos: source.pos, targetPos: target.pos });
    });
    if (!rows.length) return null;

    const color = linkColorFor(themeMode);
    return new LineLayer({
        id: 'viae-map-links',
        data: rows,
        pickable: false,
        getSourcePosition: (d) => d.sourcePos,
        getTargetPosition: (d) => d.targetPos,
        getColor: color,
        widthUnits: 'pixels',
        getWidth: 1
    });
}
