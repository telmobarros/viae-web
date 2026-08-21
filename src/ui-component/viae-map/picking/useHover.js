/**
 * rAF-throttled hover state for a deck.gl canvas.
 *
 * deck.gl fires `onHover` on essentially every pointermove over the canvas,
 * which is far more often than a React render needs to happen (each state
 * update here can cascade into a layer rebuild via updateTriggers). Coalesce
 * to at most one state update per animation frame rather than reaching for a
 * fixed millisecond debounce, which would either lag the cursor or still
 * over-fire depending on the monitor's refresh rate.
 *
 * Meant to be wired to <DeckGL onHover>, not a per-layer onHover -- with
 * multiple coincident pickable layers (nodes/routes/stops), deck.gl's
 * top-level callback is the one place that reports a single unambiguous
 * topmost hit per pointer event, including its owning `info.layer.id`. See
 * layers/nodesLayer.js's docstring.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @returns {{
 *   hovered: Object|null,
 *   hoveredLayerId: string|null,
 *   hoverPos: [number, number]|null,
 *   onHover: (info: Object) => void
 * }}
 */
export function useHover() {
    const [hovered, setHovered] = useState(null);
    const [hoveredLayerId, setHoveredLayerId] = useState(null);
    const [hoverPos, setHoverPos] = useState(null);
    const rafRef = useRef(null);
    const pendingRef = useRef(null);

    useEffect(
        () => () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        },
        []
    );

    const onHover = useCallback((info) => {
        pendingRef.current = info;
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const info2 = pendingRef.current;
            if (info2 && info2.object) {
                setHovered(info2.object);
                setHoveredLayerId((info2.layer && info2.layer.id) || null);
                setHoverPos([info2.x, info2.y]);
            } else {
                setHovered(null);
                setHoveredLayerId(null);
                setHoverPos(null);
            }
        });
    }, []);

    return { hovered, hoveredLayerId, hoverPos, onHover };
}
