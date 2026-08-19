/**
 * Viewport fitting, per spatial mode.
 *
 * Isolated and unit-tested deliberately: this is the single likeliest source
 * of "the map looks wrong". deck.gl's OrthographicView/OrbitView zoom is
 * log2-scaled and `target` is in world units, while MapView's zoom is the
 * Web-Mercator tile zoom and its centre is lng/lat -- so one naive
 * implementation cannot serve both, and getting the log2 wrong produces a
 * view that is subtly (or wildly) off rather than obviously broken.
 *
 * All three modes take the same input (a bbox in world coordinates plus the
 * pixel size of the canvas) and return a viewState of the shape the
 * corresponding View expects.
 */

const DEFAULT_PADDING = 0.1; // 10% breathing room around the data

/**
 * @param {{kind:'geo'|'plane', dims:2|3}} space
 * @param {number[]} bbox  [minX, minY, maxX, maxY]
 * @param {{width:number, height:number, padding?:number}} viewport
 */
export function fitBoundsForView(space, bbox, viewport) {
    const width = Math.max(1, viewport?.width || 1);
    const height = Math.max(1, viewport?.height || 1);
    const padding = viewport?.padding ?? DEFAULT_PADDING;

    const [minX, minY, maxX, maxY] = normalizeBbox(bbox);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    // Guard the degenerate (single point / zero-extent) case: a span of 0
    // gives log2(Infinity) below.
    const spanX = Math.max(maxX - minX, Number.EPSILON);
    const spanY = Math.max(maxY - minY, Number.EPSILON);

    if (space.kind === 'geo') {
        return fitGeo({ minX, minY, maxX, maxY, centerX, centerY, spanX, spanY, width, height, padding });
    }
    if (space.dims === 3) {
        return fitOrbit({ centerX, centerY, spanX, spanY, width, height, padding });
    }
    return fitOrthographic({ centerX, centerY, spanX, spanY, width, height, padding });
}

function normalizeBbox(bbox) {
    if (!bbox || bbox.length < 4 || !bbox.every(Number.isFinite)) return [0, 0, 1, 1];
    const [a, b, c, d] = bbox;
    // Tolerate inverted input rather than producing a negative span.
    return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
}

/**
 * Orthographic (Euclidean 2D). deck.gl renders `2 ** zoom` pixels per world
 * unit, so the zoom that makes `span` world units fill `pixels` pixels is
 * log2(pixels / span). Fit both axes and take the tighter one.
 */
function fitOrthographic({ centerX, centerY, spanX, spanY, width, height, padding }) {
    const usableW = width * (1 - padding);
    const usableH = height * (1 - padding);
    const zoom = Math.min(Math.log2(usableW / spanX), Math.log2(usableH / spanY));
    return {
        target: [centerX, centerY, 0],
        zoom: Number.isFinite(zoom) ? zoom : 0,
        minZoom: -20,
        maxZoom: 40
    };
}

/**
 * Orbit (Euclidean 3D). Same zoom maths as orthographic, backed off slightly
 * because a rotated scene needs more room than its axis-aligned footprint.
 */
function fitOrbit({ centerX, centerY, spanX, spanY, width, height, padding }) {
    const base = fitOrthographic({ centerX, centerY, spanX, spanY, width, height, padding });
    return {
        target: [centerX, centerY, 0],
        zoom: base.zoom - 0.5,
        rotationX: 30,
        rotationOrbit: -25,
        minZoom: -20,
        maxZoom: 40
    };
}

/**
 * Geographic. Web Mercator: longitude spans 360 degrees over `512 * 2**zoom`
 * pixels at the equator, latitude is fitted in projected (Mercator-y) space
 * so the fit stays correct away from the equator.
 */
function fitGeo({ minY, maxY, centerX, centerY, spanX, width, height, padding }) {
    const usableW = width * (1 - padding);
    const usableH = height * (1 - padding);
    const TILE = 512;

    const zoomX = Math.log2((usableW * 360) / (TILE * spanX));

    const yMin = mercatorY(clampLat(minY));
    const yMax = mercatorY(clampLat(maxY));
    const spanMercY = Math.max(Math.abs(yMax - yMin), Number.EPSILON);
    const zoomY = Math.log2((usableH * 2) / (TILE * spanMercY));

    const zoom = Math.min(zoomX, zoomY);
    return {
        longitude: centerX,
        latitude: centerY,
        // Clamp to the range a raster basemap can actually serve.
        zoom: Number.isFinite(zoom) ? Math.max(0, Math.min(zoom, 20)) : 2,
        pitch: 0,
        bearing: 0
    };
}

function clampLat(lat) {
    // Mercator is undefined at the poles.
    return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

/** Normalized Mercator y in [-1, 1]. */
function mercatorY(lat) {
    const rad = (lat * Math.PI) / 180;
    return Math.log(Math.tan(Math.PI / 4 + rad / 2)) / Math.PI;
}

export const __testables = { fitOrthographic, fitOrbit, fitGeo, normalizeBbox, mercatorY };
