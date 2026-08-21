/**
 * Route show/hide state -- show-all/hide-all, per-route toggle.
 *
 * Tracks HIDDEN keys rather than visible ones, so the default (nothing
 * hidden) is "every route visible" without needing to know the route list
 * up front, and a newly-arrived route (e.g. after switching solutions) is
 * visible by default rather than needing to be explicitly added to a
 * visible-set.
 *
 * Deliberately returns `visibleKeys: null` (meaning "no filter, everything
 * visible") rather than a fully-populated Set when nothing has been hidden
 * -- layers/routesLayer.js and routeStopsLayer.js already treat a null
 * visibleKeys as "show everything", so the common default case (nothing
 * hidden) skips building a Set on every render.
 */
import { useCallback, useMemo, useState } from 'react';

import { routeKey } from '../model';

export function useRouteVisibility(routes) {
    const [hidden, setHidden] = useState(() => new Set());

    const toggle = useCallback((route) => {
        const key = routeKey(route.solutionId, route.id);
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const showAll = useCallback(() => setHidden(new Set()), []);
    const hideAll = useCallback(() => setHidden(new Set((routes || []).map((r) => routeKey(r.solutionId, r.id)))), [routes]);

    const visibleKeys = useMemo(() => {
        if (hidden.size === 0) return null;
        if (!routes) return null;
        const visible = new Set();
        routes.forEach((r) => {
            const key = routeKey(r.solutionId, r.id);
            if (!hidden.has(key)) visible.add(key);
        });
        return visible;
    }, [routes, hidden]);

    return { visibleKeys, toggle, showAll, hideAll };
}
