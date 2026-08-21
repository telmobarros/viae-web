/**
 * rAF-throttled hover state for a deck.gl canvas.
 *
 * deck.gl fires `onHover` on essentially every pointermove over the canvas,
 * which is far more often than a React render needs to happen (each state
 * update here can cascade into a layer rebuild via updateTriggers). Coalesce
 * to at most one state update per animation frame rather than reaching for a
 * fixed millisecond debounce, which would either lag the cursor or still
 * over-fire depending on the monitor's refresh rate.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @returns {{ hovered: Object|null, hoverPos: [number, number]|null, onHover: (info: Object) => void }}
 */
export function useHover() {
    const [hovered, setHovered] = useState(null);
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
                setHoverPos([info2.x, info2.y]);
            } else {
                setHovered(null);
                setHoverPos(null);
            }
        });
    }, []);

    return { hovered, hoverPos, onHover };
}
