import React, { useMemo } from 'react';
import MainCard from 'ui-component/cards/MainCard';
import { useLocation, useSearchParams } from 'react-router-dom';
import D3SolutionVisualizer from './D3SolutionVisualizer';

function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

function buildDummyInstance(mode = 'euclidean', n = 500) {
    const nodes = {};
    const depotId = 1;
    for (let i = 1; i <= n; i++) {
        if (mode === 'geo') {
            nodes[i] = {
                id: i,
                isDepot: i === depotId,
                lat: 41.1 + Math.random() * 0.5,
                lng: -8.7 + Math.random() * 0.5
            };
        } else {
            nodes[i] = {
                id: i,
                isDepot: i === depotId,
                x: Math.random() * 1000,
                y: Math.random() * 800
            };
        }
    }
    const links = [];
    for (let k = 0; k < Math.min(2000, Math.floor(n * 2)); k++) {
        const s = Math.floor(Math.random() * n) + 1;
        const t = Math.floor(Math.random() * n) + 1;
        if (s !== t) links.push({ source: s, target: t });
    }
    return { nodes, links, coordinates: mode === 'geo' ? 'lat_lng' : 'euclidean' };
}

function buildDummySolutions(ids = [1, 2], nNodes = 500) {
    const out = {};
    for (const id of ids) {
        const routes = [];
        const nRoutes = 3 + Math.floor(Math.random() * 4);
        const used = new Set([1]);
        for (let r = 0; r < nRoutes; r++) {
            const m = 15 + Math.floor(Math.random() * 25);
            const stops = [];
            for (let j = 0; j < m; j++) {
                let nid;
                do {
                    nid = 1 + Math.floor(Math.random() * nNodes);
                } while (used.has(nid));
                used.add(nid);
                stops.push({ node_id: nid, sequence: j });
            }
            routes.push({ id: `${id}-${r}`, stops });
        }
        out[id] = { id, routes };
    }
    return out;
}

const VisualizerPage = () => {
    const query = useQuery();
    const [params] = useSearchParams();
    const mode = query.get('mode') === 'geo' ? 'geo' : 'euclidean';
    const ids = (query.get('solutions') || '1,2')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => (isNaN(+x) ? x : +x));

    const instance = useMemo(() => buildDummyInstance(mode, 1000), [mode]);
    const solutions = useMemo(() => buildDummySolutions(ids, 1000), [ids]);

    return (
        <MainCard title="Solution Visualizer (D3)">
            <D3SolutionVisualizer instance={instance} solutions={solutions} defaultSelected={ids} mode={mode} />
        </MainCard>
    );
};

export default VisualizerPage;
