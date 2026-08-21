/**
 * Hover state must coalesce to at most one state update per animation
 * frame -- deck.gl calls onHover on essentially every pointermove, and
 * without throttling each call could cascade into a layer rebuild via
 * updateTriggers.
 */
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';

import { useHover } from '../picking/useHover';

// See useSelection.test.js for why this flag is needed here.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mountHook() {
    let latest;
    function Harness() {
        latest = useHover();
        return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(<Harness />);
    });
    return {
        get current() {
            return latest;
        },
        unmount: () => {
            act(() => root.unmount());
            container.remove();
        }
    };
}

describe('useHover', () => {
    let rafSpy;
    let pendingCallbacks;

    beforeEach(() => {
        pendingCallbacks = [];
        rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            pendingCallbacks.push(cb);
            return pendingCallbacks.length;
        });
        jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    });

    afterEach(() => {
        rafSpy.mockRestore();
    });

    function flush() {
        const cbs = pendingCallbacks;
        pendingCallbacks = [];
        act(() => cbs.forEach((cb) => cb()));
    }

    it('starts with nothing hovered', () => {
        const h = mountHook();
        expect(h.current.hovered).toBeNull();
        h.unmount();
    });

    it('sets hovered object and position after the animation frame fires', () => {
        const h = mountHook();
        act(() => h.current.onHover({ object: { id: 1 }, x: 12, y: 34 }));
        expect(h.current.hovered).toBeNull(); // not yet -- frame hasn't fired
        flush();
        expect(h.current.hovered).toEqual({ id: 1 });
        expect(h.current.hoverPos).toEqual([12, 34]);
        h.unmount();
    });

    it('collapses multiple onHover calls within one frame into a single update', () => {
        const h = mountHook();
        act(() => {
            h.current.onHover({ object: { id: 1 }, x: 1, y: 1 });
            h.current.onHover({ object: { id: 2 }, x: 2, y: 2 });
            h.current.onHover({ object: { id: 3 }, x: 3, y: 3 });
        });
        expect(rafSpy).toHaveBeenCalledTimes(1); // only one frame scheduled
        flush();
        expect(h.current.hovered).toEqual({ id: 3 }); // reflects the LATEST call
        h.unmount();
    });

    it('clears hover when the pointer leaves every object', () => {
        const h = mountHook();
        act(() => h.current.onHover({ object: { id: 1 }, x: 1, y: 1 }));
        flush();
        act(() => h.current.onHover({ object: null }));
        flush();
        expect(h.current.hovered).toBeNull();
        expect(h.current.hoverPos).toBeNull();
        h.unmount();
    });
});
