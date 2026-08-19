import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Popup, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import authAxios from 'utils/axios';
import D3SolutionVisualizer from '../visualizers/D3SolutionVisualizer';

// Defaults replaced when API data loads
const dummyNodes = {};
const dummyLinks = [];

const VRPVisualizer = ({ isGeographical, solutionIds }) => {
    const [nodes, setNodes] = useState(dummyNodes);
    const [links, setLinks] = useState(dummyLinks);
    const [solutions, setSolutions] = useState({});
    const [selectedSolutions, setSelectedSolutions] = useState([]);

    useEffect(() => {
        async function load() {
            if (!solutionIds || !solutionIds.length) return;
            try {
                const ids = solutionIds.join(',');
                const res = await authAxios.get(`http://localhost:5000/api/v1/visualizer/solutions`, { params: { ids } });
                const payload = res?.data?.result;
                if (!payload) return;
                setNodes(payload.instance.nodes || {});
                setLinks(payload.instance.links || []);
                setSolutions(payload.solutions || {});
                // default select the provided solution ids
                setSelectedSolutions(solutionIds);
            } catch (e) {
                // keep dummy if fails
            }
        }
        load();
    }, [solutionIds]);

    const firstNode = Object.values(nodes || {})[0];
    const autoGeo = firstNode && firstNode.lat != null && firstNode.lng != null && (firstNode.x == null || firstNode.y == null);
    const useGeo = isGeographical || autoGeo;

    return (
        <div>
            {useGeo ? (
                <LeafletMap nodes={nodes} links={links} solutions={solutions} selectedSolutions={selectedSolutions} showLinks={true} />
            ) : (
                <D3SolutionVisualizer
                    instance={{ nodes, links, coordinates: 'euclidean' }}
                    solutions={solutions}
                    defaultSelected={selectedSolutions}
                    mode="euclidean"
                    height={500}
                />
            )}
        </div>
    );
};

const getColorByIndex = (index) => {
    const colors = ['red', 'blue', 'green', 'orange', 'purple', 'pink', 'yellow', 'cyan', 'magenta', 'lime'];
    return colors[index % colors.length];
};
const LeafletMap = ({ nodes, links, solutions, selectedSolutions, showLinks }) => {
    const initialPosition = [51.505, -0.09];
    const zoom = 13;

    return (
        <MapContainer center={initialPosition} zoom={zoom} style={{ height: '500px' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

            {showLinks &&
                links.map((link, index) => {
                    const sourceNode = nodes[link.source];
                    const targetNode = nodes[link.target];
                    return (
                        <Polyline
                            key={index}
                            positions={[
                                [sourceNode.lat, sourceNode.lng],
                                [targetNode.lat, targetNode.lng]
                            ]}
                            color="grey"
                        />
                    );
                })}
            {Object.values(nodes).map((node) => (
                <CircleMarker key={node.id} center={[node.lat, node.lng]} color={node.isDepot ? 'red' : 'blue'}>
                    <Popup>{node.label}</Popup>
                </CircleMarker>
            ))}

            {selectedSolutions.map((solutionId) => {
                const solution = solutions[solutionId];
                if (solution) {
                    return solution.routes.map((route, routeIndex) => (
                        <Polyline
                            key={`solution-${solutionId}-route-${routeIndex}`}
                            positions={route.stops.map((stop) => [nodes[stop.node_id].lat, nodes[stop.node_id].lng])}
                            color={getColorByIndex(solutionId)}
                        />
                    ));
                }
                return null;
            })}
        </MapContainer>
    );
};

export default VRPVisualizer;
