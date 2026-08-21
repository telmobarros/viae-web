/**
 * Click-to-pin selection.
 *
 * Hover already gives a lightweight preview (see picking/useHover.js); click
 * promotes that into a pinned selection that survives the pointer moving
 * away -- the interaction the current canvas cannot do at all, since it has
 * no hit-testing. Clicking the already-pinned object, or empty space,
 * unpins.
 *
 * Supports the controlled/uncontrolled split ViaeMap's prop contract needs:
 * a consumer that cares about the selection (e.g. to drive an inspector
 * panel in a later phase) passes `nodeId` + `onChange`; one that doesn't
 * passes neither and the hook manages its own state.
 */
import { useCallback, useState } from 'react';

export function useSelection({ nodeId, onChange } = {}) {
    const controlled = nodeId !== undefined;
    const [internal, setInternal] = useState(null);
    const selectedId = controlled ? nodeId : internal;

    const setSelected = useCallback(
        (id) => {
            if (onChange) onChange(id);
            if (!controlled) setInternal(id);
        },
        [controlled, onChange]
    );

    const onClick = useCallback(
        (info) => {
            const clickedId = info && info.object ? info.object.id : null;
            setSelected(clickedId !== null && clickedId === selectedId ? null : clickedId);
        },
        [selectedId, setSelected]
    );

    const clear = useCallback(() => setSelected(null), [setSelected]);

    return { selectedId, onClick, clear };
}
