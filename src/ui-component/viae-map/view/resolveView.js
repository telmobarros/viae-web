/**
 * Spatial space -> deck.gl View.
 *
 * A pure lookup, deliberately: the decision itself was already made by the
 * adapter from the backend's authoritative field. No field-sniffing, no
 * heuristics, no querystring override buried in a component.
 */
import { MapView, OrbitView, OrthographicView } from '@deck.gl/core';

export const SpaceMode = {
    GEO: 'geo',
    PLANE_2D: 'plane2d',
    PLANE_3D: 'plane3d'
};

/** Space -> a stable mode string, used for UI labels and view selection. */
export function spaceMode(space) {
    if (!space) return SpaceMode.PLANE_2D;
    if (space.kind === 'geo') return SpaceMode.GEO;
    return space.dims === 3 ? SpaceMode.PLANE_3D : SpaceMode.PLANE_2D;
}

export const MODE_LABEL = {
    [SpaceMode.GEO]: 'Geographic',
    [SpaceMode.PLANE_2D]: 'Euclidean 2D',
    [SpaceMode.PLANE_3D]: 'Euclidean 3D'
};

/**
 * Build the View instance for a mode.
 *
 * `repeat` on MapView keeps the world tiling horizontally; the orthographic
 * and orbit views are plain because a Cartesian instance has no notion of
 * wrapping.
 */
export function resolveView(mode) {
    switch (mode) {
        case SpaceMode.GEO:
            return new MapView({ id: 'geo', repeat: true, controller: true });
        case SpaceMode.PLANE_3D:
            return new OrbitView({ id: 'orbit', controller: true });
        case SpaceMode.PLANE_2D:
        default:
            return new OrthographicView({ id: 'ortho', controller: true });
    }
}

/**
 * Whether a raster basemap is meaningful for this mode.
 *
 * Only geographic coordinates have a real-world position, so mounting tiles
 * under Cartesian data would be nonsense -- and `assertScene` treats doing so
 * as a bug rather than a cosmetic choice.
 */
export function supportsBasemap(mode) {
    return mode === SpaceMode.GEO;
}
