/**
 * Click-to-pin selection logic: click selects, clicking the same object
 * again unpins, clicking empty space unpins. Exercised through a minimal
 * react-dom harness (no testing-library dependency in this project) rather
 * than by re-implementing the hook's logic as a plain function, since the
 * controlled/uncontrolled split is the part actually worth protecting.
 */
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';

import { useSelection } from '../selection/useSelection';

// React 18's createRoot requires this flag outside of a testing-library
// setup (which sets it internally); without it act() warns even though the
// updates are correctly wrapped.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mountHook(props) {
    let latest;
    function Harness(hookProps) {
        latest = useSelection(hookProps);
        return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(<Harness {...props} />);
    });
    return {
        get current() {
            return latest;
        },
        rerender: (nextProps) => {
            act(() => {
                root.render(<Harness {...nextProps} />);
            });
        },
        unmount: () => {
            act(() => root.unmount());
            container.remove();
        }
    };
}

describe('useSelection (uncontrolled)', () => {
    it('starts with nothing selected', () => {
        const h = mountHook({});
        expect(h.current.selectedId).toBeNull();
        h.unmount();
    });

    it('selects on click', () => {
        const h = mountHook({});
        act(() => h.current.onClick({ object: { id: 7 } }));
        expect(h.current.selectedId).toBe(7);
        h.unmount();
    });

    it('unpins when clicking the already-selected object again', () => {
        const h = mountHook({});
        act(() => h.current.onClick({ object: { id: 7 } }));
        act(() => h.current.onClick({ object: { id: 7 } }));
        expect(h.current.selectedId).toBeNull();
        h.unmount();
    });

    it('unpins when clicking empty space', () => {
        const h = mountHook({});
        act(() => h.current.onClick({ object: { id: 7 } }));
        act(() => h.current.onClick({}));
        expect(h.current.selectedId).toBeNull();
        h.unmount();
    });

    it('switches selection when clicking a different object', () => {
        const h = mountHook({});
        act(() => h.current.onClick({ object: { id: 7 } }));
        act(() => h.current.onClick({ object: { id: 9 } }));
        expect(h.current.selectedId).toBe(9);
        h.unmount();
    });
});

describe('useSelection (controlled)', () => {
    it('reflects the controlled nodeId prop rather than internal state', () => {
        const h = mountHook({ nodeId: 3 });
        expect(h.current.selectedId).toBe(3);
        h.unmount();
    });

    it('calls onChange instead of mutating its own state when controlled', () => {
        const onChange = jest.fn();
        const h = mountHook({ nodeId: 3, onChange });
        act(() => h.current.onClick({ object: { id: 5 } }));
        expect(onChange).toHaveBeenCalledWith(5);
        // Still reflects the prop (unchanged by the caller in this test), not 5.
        expect(h.current.selectedId).toBe(3);
        h.unmount();
    });
});
