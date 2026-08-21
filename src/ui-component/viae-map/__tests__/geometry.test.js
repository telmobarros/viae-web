import { routePositions, solutionPositions, splitIntoSegments } from '../scale/geometry';

describe('splitIntoSegments', () => {
    it('returns one segment when nothing is missing', () => {
        const segs = splitIntoSegments([
            [0, 0],
            [1, 0],
            [2, 0]
        ]);
        expect(segs).toEqual([
            [
                [0, 0],
                [1, 0],
                [2, 0]
            ]
        ]);
    });

    it('splits into two contiguous segments around a single gap (the A-B-[C]-D case)', () => {
        // This is the exact scenario from the Phase 5 requirement: a route
        // A->B->C->D where C has no coordinates must render as [A,B] and
        // [D] -- never as a single [A,B,D] segment, which would invent a
        // B->D edge that was never part of the route.
        const segs = splitIntoSegments([[0, 0], [1, 0], null, [3, 0]]);
        expect(segs).toEqual([
            [
                [0, 0],
                [1, 0]
            ],
            [[3, 0]]
        ]);
    });

    it('collapses consecutive gaps into a single break, not empty segments', () => {
        const segs = splitIntoSegments([[0, 0], null, null, [3, 0]]);
        expect(segs).toEqual([[[0, 0]], [[3, 0]]]);
    });

    it('drops leading/trailing gaps without an empty segment', () => {
        const segs = splitIntoSegments([null, [1, 0], [2, 0], null]);
        expect(segs).toEqual([
            [
                [1, 0],
                [2, 0]
            ]
        ]);
    });

    it('returns no segments when every position is missing', () => {
        expect(splitIntoSegments([null, null])).toEqual([]);
    });

    it('handles an empty input', () => {
        expect(splitIntoSegments([])).toEqual([]);
        expect(splitIntoSegments(undefined)).toEqual([]);
    });

    it('keeps a single-point run as a one-point segment rather than dropping it', () => {
        const segs = splitIntoSegments([null, [1, 0], null]);
        expect(segs).toEqual([[[1, 0]]]);
    });
});

describe('routePositions / solutionPositions', () => {
    const route = {
        segments: [
            [
                [0, 0],
                [1, 0]
            ],
            [
                [3, 0],
                [4, 0]
            ]
        ]
    };

    it('flattens all segments of a route into one position list', () => {
        expect(routePositions(route)).toEqual([
            [0, 0],
            [1, 0],
            [3, 0],
            [4, 0]
        ]);
    });

    it('returns an empty array for a route with no segments', () => {
        expect(routePositions({})).toEqual([]);
        expect(routePositions(null)).toEqual([]);
    });

    it('flattens every route of a solution', () => {
        const solution = { routes: [route, { segments: [[[9, 9]]] }] };
        expect(solutionPositions(solution)).toEqual([
            [0, 0],
            [1, 0],
            [3, 0],
            [4, 0],
            [9, 9]
        ]);
    });

    it('returns an empty array for a solution with no routes', () => {
        expect(solutionPositions({})).toEqual([]);
        expect(solutionPositions(null)).toEqual([]);
    });
});
