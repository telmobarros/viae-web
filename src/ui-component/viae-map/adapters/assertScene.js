/**
 * Dev-only Scene invariant checks.
 *
 * These exist because the two historical coordinate bugs in this codebase
 * were both silent: a transposed Euclidean instance still renders (just
 * wrongly), and a real-world basemap under Cartesian points still renders
 * (just absurdly). Both would have been caught by an assertion here.
 *
 * No-ops in production builds.
 */

const isDev = process.env.NODE_ENV !== 'production';

function warn(msg, detail) {
    // eslint-disable-next-line no-console
    console.warn(`[ViaeMap] ${msg}`, detail ?? '');
}

/**
 * @param {Object} scene
 * @param {{basemapMounted?: boolean}} [context]
 * @returns {string[]} problems found (empty when valid)
 */
export function assertScene(scene, context = {}) {
    if (!isDev || !scene) return [];
    const problems = [];

    if (!scene.space || !['geo', 'plane'].includes(scene.space.kind)) {
        problems.push('scene.space.kind must be "geo" or "plane"');
        problems.forEach((p) => warn(p));
        return problems;
    }

    const isGeo = scene.space.kind === 'geo';
    const nodes = scene.nodes || [];

    // 1. Geographic coordinates must be plausible degrees. A Cartesian
    //    instance mislabelled as geographic shows up here immediately --
    //    benchmark coordinates are routinely > 180.
    if (isGeo) {
        let outOfRange = 0;
        let sampleBad = null;
        for (let i = 0; i < nodes.length; i += 1) {
            const p = nodes[i].pos;
            if (!p) continue;
            if (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) {
                outOfRange += 1;
                if (!sampleBad) sampleBad = { id: nodes[i].id, pos: p };
            }
        }
        if (outOfRange > 0) {
            problems.push(
                `${outOfRange} node(s) are outside valid lng/lat range in a 'geo' scene ` +
                    '-- likely a Cartesian instance mislabelled as geographic, or transposed axes'
            );
            warn(problems[problems.length - 1], sampleBad);
        }
    }

    // 2. A basemap under Cartesian data is always wrong.
    if (!isGeo && context.basemapMounted) {
        problems.push("a raster basemap is mounted on a 'plane' scene -- real-world tiles under Cartesian coordinates");
        warn(problems[problems.length - 1]);
    }

    // 3. Non-finite coordinates reach the GPU as NaN and silently vanish.
    let nonFinite = 0;
    for (let i = 0; i < nodes.length; i += 1) {
        const p = nodes[i].pos;
        if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) nonFinite += 1;
    }
    if (nonFinite > 0) {
        problems.push(`${nonFinite} node(s) have non-finite coordinates`);
        warn(problems[problems.length - 1]);
    }

    // 4. A degenerate bbox makes every fit collapse to one pixel.
    const bbox = scene.bbox;
    if (!bbox || bbox.length < 4 || !bbox.every(Number.isFinite)) {
        problems.push('scene.bbox is missing or non-finite');
        warn(problems[problems.length - 1], bbox);
    }

    // 5. A route stop that is genuinely coordinate-less (r.missingCoordinates)
    //    is an EXPECTED data state, not a bug -- it is not reported here.
    //    (adapters/index.js already renders it honestly as a segment break,
    //    per scale/geometry.js, rather than an invented straight line; the
    //    UI surfaces it as an informational diagnostic, not a warning.)
    //
    //    A route stop missing FROM THE PAYLOAD ENTIRELY (r.missingFromPayload)
    //    is different: the route-preserving node budget (capBackgroundNodes)
    //    exists specifically so a routed node is never sampled away, so this
    //    should be structurally impossible. A non-zero count here means that
    //    invariant broke somewhere upstream, and is treated as a real bug.
    (scene.solutions || []).forEach((sol) => {
        (sol.routes || []).forEach((r) => {
            if (r.missingFromPayload > 0) {
                const msg =
                    `route ${r.id} references ${r.missingFromPayload} node(s) absent from the payload entirely ` +
                    '-- the route-preserving node budget should make this impossible; a routed node was likely sampled away upstream';
                problems.push(msg);
                warn(msg, { routeId: r.id, missingFromPayload: r.missingFromPayload });
            }
        });
    });

    // 6. Live snapshots that mixed coordinate systems.
    if (scene.source && scene.source.mixedSpace) {
        const msg = 'live snapshot contained BOTH geodesic and euclidean stops -- majority used; this is a server bug';
        problems.push(msg);
        warn(msg);
    }

    return problems;
}

/**
 * Overlay/scene spatial compatibility.
 *
 * Guards against overlaying real GPS positions onto a Cartesian instance (or
 * vice versa) -- which renders "successfully" and is entirely meaningless.
 */
export function assertOverlayCompatible(scene, overlaySpace, label = 'overlay') {
    if (!isDev || !scene || !overlaySpace) return true;
    if (scene.space.kind !== overlaySpace.kind) {
        warn(`${label} space '${overlaySpace.kind}' does not match scene space '${scene.space.kind}' -- refusing to overlay`);
        return false;
    }
    return true;
}
