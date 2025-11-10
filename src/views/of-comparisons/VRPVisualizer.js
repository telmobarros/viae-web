import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import {
    OutlinedInput,
    InputLabel,
    MenuItem,
    FormControl,
    FormControlLabel,
    ListItemText,
    Select,
    Checkbox,
    Box,
    Typography
} from '@mui/material';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';
import { points3D, gridPlanes3D, lineStrips3D, lines3D } from 'd3-3d';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
    PaperProps: {
        style: {
            maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
            width: 250
        }
    }
};

const dummyNodes = {};
const totalNodes = 100;
const depotId = 1; // Random depot ID

for (let i = 1; i <= totalNodes; i++) {
    dummyNodes[i] = {
        id: i,
        label: i === depotId ? 'Depot' : `Customer ${i}`,
        isDepot: i === depotId,
        lat: 51.505 + Math.random() * 0.05,
        lng: -0.09 + Math.random() * 0.05,
        x: Math.random() * 300,
        y: Math.random() * 300
        //z: Math.random() * 100
    };
}

const dummyLinks = [];
const totalLinks = Math.floor(Math.random() * totalNodes * 2); // Random number of links

for (let i = 0; i < totalLinks; i++) {
    const sourceId = Math.floor(Math.random() * totalNodes) + 1;
    const targetId = Math.floor(Math.random() * totalNodes) + 1;

    // Ensure no self-loop and no duplicate links (same source and target)
    if (sourceId !== targetId) {
        dummyLinks.push({ source: sourceId, target: targetId });
    }
}

// Generate random dummy solutions
const generateDummySolutions = (solutionIds, maxRoutesPerSolution) => {
    const solutions = {};
    solutionIds.forEach((id) => {
        const routes = [];
        const numRoutes = Math.floor(Math.random() * maxRoutesPerSolution) + 1;
        for (let j = 0; j < numRoutes; j++) {
            const stops = [];
            const routeLength = Math.floor(Math.random() * (totalNodes / 2)) + 1;
            const usedNodes = new Set();
            for (let k = 0; k < routeLength; k++) {
                let nodeId;
                do {
                    nodeId = Math.floor(Math.random() * totalNodes) + 1;
                } while (usedNodes.has(nodeId) || nodeId === depotId);
                usedNodes.add(nodeId);
                stops.push({ node_id: nodeId, sequence: k });
            }
            routes.push({ stops });
        }
        solutions[id] = { id, routes };
    });
    return solutions;
};

// Assume max 10 routes per solution, using given solutionIds
const VRPVisualizer = ({ isGeographical, solutionIds }) => {
    const [nodes, setNodes] = useState(dummyNodes);
    const [links, setLinks] = useState(dummyLinks);
    const [solutions, setSolutions] = useState([]);
    const [selectedSolutions, setSelectedSolutions] = useState([]);
    const [showLinks, setShowLinks] = useState(true);

    useEffect(() => {
        // Update nodes and links based on selectedSolutions, fetch data from an API if necessary
    }, [selectedSolutions]);

    useEffect(() => {
        // generate dummy solutions
        const tmp_solutions = {};
        for (const id of solutionIds) {
            tmp_solutions[id] = generateDummySolutions([id], 10)[id];
        }
        setSolutions({ ...tmp_solutions });
    }, []);

    const handleSolutionChange = (event) => {
        const {
            target: { value }
        } = event;
        setSelectedSolutions(typeof value === 'string' ? value.split(',') : value);
    };

    const handleShowLinksChange = (event) => {
        setShowLinks(event.target.checked);
    };

    return (
        <div>
            <SolutionSelector solutionIds={solutionIds} selectedSolutions={selectedSolutions} onSolutionChange={handleSolutionChange} />
            <FormControlLabel control={<Checkbox checked={showLinks} onChange={handleShowLinksChange} />} label="Show Links" />
            {isGeographical ? (
                <LeafletMap nodes={nodes} links={links} solutions={solutions} selectedSolutions={selectedSolutions} showLinks={showLinks} />
            ) : nodes[1].z == null ? (
                <SVGMap nodes={nodes} links={links} solutions={solutions} selectedSolutions={selectedSolutions} showLinks={showLinks} />
            ) : (
                <D33DMap nodes={nodes} links={links} solutions={solutions} selectedSolutions={selectedSolutions} showLinks={showLinks} />
            )}
            <Legend selectedSolutions={selectedSolutions} />
        </div>
    );
};

const SolutionSelector = ({ solutionIds, selectedSolutions, onSolutionChange }) => {
    return (
        <FormControl sx={{ m: 1, width: 300 }}>
            <InputLabel id="solution-selector-label">Select Solutions</InputLabel>
            <Select
                labelId="solution-selector-label"
                id="solution-selector"
                multiple
                value={selectedSolutions}
                onChange={onSolutionChange}
                input={<OutlinedInput label="Select Solutions" />}
                renderValue={(selected) => selected.join(', ')}
                MenuProps={MenuProps}
                size="small"
            >
                {solutionIds.map((id) => (
                    <MenuItem key={id} value={id}>
                        <Checkbox checked={selectedSolutions.indexOf(id) > -1} />
                        <ListItemText primary={`Solution ${id}`} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};

const getColorByIndex = (index) => {
    const colors = ['red', 'blue', 'green', 'orange', 'purple', 'pink', 'yellow', 'cyan', 'magenta', 'lime'];
    return colors[index % colors.length];
};

const Legend = ({ selectedSolutions }) => (
    <Box display="flex" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" mr={2}>
            <Box width={20} height={20} bgcolor="red" mr={1} />
            <Typography variant="body2">Depot</Typography>
        </Box>
        <Box display="flex" alignItems="center" mr={2}>
            <Box width={20} height={20} bgcolor="blue" mr={1} />
            <Typography variant="body2">Customer</Typography>
        </Box>
        <Box display="flex" alignItems="center" mr={2}>
            <Box width={20} height={20} bgcolor="grey" mr={1} />
            <Typography variant="body2">Links</Typography>
        </Box>
        {selectedSolutions.map((solutionId) => (
            <Box display="flex" alignItems="center" mr={2} key={solutionId}>
                <Box width={20} height={20} bgcolor={getColorByIndex(solutionId)} mr={1} />
                <Typography variant="body2">Solution {solutionId}</Typography>
            </Box>
        ))}
    </Box>
);

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

const SVGMap = ({ nodes, links, solutions, selectedSolutions, showLinks }) => {
    const svgRef = useRef();
    const gLinkRef = useRef();
    const gSolutionsRef = useRef([]);
    const gNodeRef = useRef();

    const width = 960;
    const height = 500;
    const nodeRadius = 12;
    const linkWidth = 2;
    const k = height / width;

    const xAxis = (g, x) =>
        g
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisTop(x).ticks(12))
            .call((g) => g.select('.domain').attr('display', 'none'));

    const yAxis = (g, y) => g.call(d3.axisRight(y).ticks(12 * k)).call((g) => g.select('.domain').attr('display', 'none'));

    const grid = (g, x, y) =>
        g
            .attr('stroke', 'currentColor')
            .attr('stroke-opacity', 0.1)
            .call((g) =>
                g
                    .selectAll('.x')
                    .data(x.ticks(12))
                    .join(
                        (enter) => enter.append('line').attr('class', 'x').attr('y2', height),
                        (update) => update,
                        (exit) => exit.remove()
                    )
                    .attr('x1', (d) => 0.5 + x(d))
                    .attr('x2', (d) => 0.5 + x(d))
            )
            .call((g) =>
                g
                    .selectAll('.y')
                    .data(y.ticks(12 * k))
                    .join(
                        (enter) => enter.append('line').attr('class', 'y').attr('x2', width),
                        (update) => update,
                        (exit) => exit.remove()
                    )
                    .attr('y1', (d) => 0.5 + y(d))
                    .attr('y2', (d) => 0.5 + y(d))
            );

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, width]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    useEffect(() => {
        const svg = d3.select(svgRef.current).attr('width', '100%').attr('height', height).attr('viewBox', `0 0  ${width} ${height}`);

        const zoom = d3.zoom().scaleExtent([0.005, 10]).on('zoom', zoomed);
        /*.on('zoom', (event) => {
                const transform = event.transform;
                const updatedXScale = transform.rescaleX(xScale);
                const updatedYScale = transform.rescaleY(yScale);

                svg.selectAll('circle')
                    .attr('cx', (d) => updatedXScale(d.x))
                    .attr('cy', (d) => updatedYScale(d.y));
            });*/

        const gGrid = svg.append('g');

        const gx = svg.append('g');

        const gy = svg.append('g');

        const gLink = d3
            .select(gLinkRef.current)
            .attr('stroke', '#999')
            .attr('stroke-opacity', showLinks ? 0.6 : 0.0);

        gLink
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('x1', (d) => xScale(nodes[d.source].x))
            .attr('y1', (d) => yScale(nodes[d.source].y))
            .attr('x2', (d) => xScale(nodes[d.target].x))
            .attr('y2', (d) => yScale(nodes[d.target].y));

        console.log(solutions);
        Object.values(solutions).map((solution, i) => {
            let solutionsLines = [];
            solution.routes.map((route) => {
                const routeLines = [];
                // sort the stops by sequence
                route.stops.sort((a, b) => a.sequence - b.sequence);
                for (let i = 0; i < route.stops.length - 1; i++) {
                    const source = route.stops[i].node_id;
                    const target = route.stops[i + 1].node_id;
                    routeLines.push({ source, target });
                    solutionsLines.push({ source, target });
                }
            });
            console.log(solution);
            console.log(solutionsLines);

            const gSolution = d3.select(gSolutionsRef.current[i]);
            gSolution
                .selectAll('line')
                .data(solutionsLines)
                .join('line')
                .attr('x1', (d) => xScale(nodes[d.source].x))
                .attr('y1', (d) => yScale(nodes[d.source].y))
                .attr('x2', (d) => xScale(nodes[d.target].x))
                .attr('y2', (d) => yScale(nodes[d.target].y));
        });
        const gNode = d3.select(gNodeRef.current).attr('fill', 'none').attr('stroke-linecap', 'round').attr('stroke-width', nodeRadius);

        gNode
            .selectAll('path')
            .data(Object.values(nodes))
            .join('path')
            .attr('d', (d) => `M${xScale(d.x)},${yScale(d.y)}h0`)
            .attr('stroke', (d) => (d.isDepot ? 'red' : 'blue'));

        /*svg.selectAll('circle')
            .data(Object.values(nodes))
            .join('circle')
            .attr('r', 5)
            .attr('cx', (d) => xScale(d.x))
            .attr('cy', (d) => yScale(d.y))
            .attr('fill', 'blue');*/

        svg.call(zoom);

        function zoomed({ transform }) {
            const zx = transform.rescaleX(xScale).interpolate(d3.interpolateRound);
            const zy = transform.rescaleY(yScale).interpolate(d3.interpolateRound);
            gNode.attr('transform', transform).attr('stroke-width', nodeRadius / transform.k);
            gLink.attr('transform', transform).attr('stroke-width', linkWidth / transform.k);
            gSolutionsRef.current.map((gSolution) =>
                d3
                    .select(gSolution)
                    .attr('transform', transform)
                    .attr('stroke-width', linkWidth / transform.k)
            );
            gx.call(xAxis, zx);
            gy.call(yAxis, zy);
            gGrid.call(grid, zx, zy);
        }
    }, []);

    useEffect(() => {
        // toggle links
        d3.select(gLinkRef.current).attr('stroke-opacity', showLinks ? 0.6 : 0.0);
    }, [showLinks]);

    useEffect(() => {
        Object.keys(solutions).map((solutionId, i) => {
            d3.select(gSolutionsRef.current[i]).attr('stroke-opacity', selectedSolutions.includes(parseInt(solutionId)) ? 0.6 : 0.0);
        });
    }, [selectedSolutions]);

    useEffect(() => {
        console.log(gSolutionsRef.current);
        gSolutionsRef.current = gSolutionsRef.current.slice(0, solutions.length);
        Object.values(solutions).map((solution, i) => {
            let solutionsLines = [];
            solution.routes.map((route) => {
                const routeLines = [];
                // sort the stops by sequence
                route.stops.sort((a, b) => a.sequence - b.sequence);
                for (let i = 0; i < route.stops.length - 1; i++) {
                    const source = route.stops[i].node_id;
                    const target = route.stops[i + 1].node_id;
                    routeLines.push({ source, target });
                    solutionsLines.push({ source, target });
                }
            });
            console.log(solution);
            console.log(solutionsLines);

            const gSolution = d3.select(gSolutionsRef.current[i]);
            gSolution
                .selectAll('line')
                .data(solutionsLines)
                .join('line')
                .attr('x1', (d) => xScale(nodes[d.source].x))
                .attr('y1', (d) => yScale(nodes[d.source].y))
                .attr('x2', (d) => xScale(nodes[d.target].x))
                .attr('y2', (d) => yScale(nodes[d.target].y));
        });

        /*const zoom = d3.zoom().scaleExtent([0.005, 10]).on('zoom', zoomed);
        d3.select(svgRef.current).call(zoom);

        function zoomed({ transform }) {
            Object.keys(solutions).map((solutionId, i) => {
                d3.select(gSolutionsRef.current[i])
                    .attr('transform', transform)
                    .attr('stroke-width', linkWidth / transform.k);
            });
        }*/
    }, [solutions]);

    return (
        <svg ref={svgRef}>
            <g ref={gLinkRef} />
            {Object.keys(solutions).map((solutionId, i) => (
                <g key={solutionId} ref={(el) => (gSolutionsRef.current[i] = el)} stroke={getColorByIndex(solutionId)} />
            ))}
            <g ref={gNodeRef} />
        </svg>
    );
};

const D33DMap = ({ nodes, links, solutions, selectedSolutions, showLinks }) => {
    const containerRef = useRef(null);
    const gLinkRef = useRef(null);

    useEffect(() => {
        const origin = { x: 480, y: 250 };
        const j = 10;
        const scale = 20;
        const startAngle = Math.PI / 4;

        let scatter = [];
        let yLine = [];
        let xGrid = [];
        let linkLines = []; // For link data
        let solutionsLines = []; // For solutions data
        let beta = 0;
        let alpha = 0;
        let zoomScale = 1; // Added zoom scale
        let mx,
            my,
            mouseX = 0,
            mouseY = 0;

        const svg = d3.select(containerRef.current).attr('width', '100%').attr('height', 500).attr('viewBox', '0 0 960 500');

        const g = svg.append('g');

        const grid3d = gridPlanes3D().rows(20).origin(origin).rotateY(startAngle).rotateX(-startAngle).scale(scale);
        const points3d = points3D().origin(origin).rotateY(startAngle).rotateX(-startAngle).scale(scale);
        const yScale3d = lineStrips3D().origin(origin).rotateY(startAngle).rotateX(-startAngle).scale(scale);
        const links3d = lines3D().origin(origin).rotateY(startAngle).rotateX(-startAngle).scale(scale); // Initialize lines3D
        const solutions3d = Object.keys(solutions).map((solution_id) => {
            return lines3D().origin(origin).rotateY(startAngle).rotateX(-startAngle).scale(scale);
        });

        const zoom = d3
            .zoom()
            .scaleExtent([0.5, 10])
            .on('zoom', (event) => {
                zoomScale = event.transform.k;
                updateData();
            });

        const drag = d3.drag().on('drag', dragged).on('start', dragStart).on('end', dragEnd);

        svg.call(drag).call(zoom);

        function processData(data, tt) {
            /* ----------- GRID ----------- */
            const xGridSelection = g.selectAll('path.grid').data(data[0]);

            xGridSelection
                .enter()
                .append('path')
                .attr('class', 'd3-3d grid')
                .merge(xGridSelection)
                .attr('stroke', 'black')
                .attr('stroke-width', 0.3)
                .attr('fill', (d) => (d.ccw ? '#eee' : '#aaa'))
                .attr('fill-opacity', 0.9)
                .attr('d', grid3d.draw);

            xGridSelection.exit().remove();

            /* ----------- POINTS ----------- */
            const pointsSelection = g.selectAll('circle').data(data[1]);

            pointsSelection
                .enter()
                .append('circle')
                .attr('class', 'd3-3d')
                //.attr('opacity', 0)
                .merge(pointsSelection)
                //.transition()
                //.duration(tt)
                .attr('r', 3)
                .attr('stroke', (d) => d3.color(d3.scaleOrdinal(d3.schemeCategory10)(d.id)).darker(3))
                .attr('fill', (d) => d3.scaleOrdinal(d3.schemeCategory10)(d.id))
                //.attr('opacity', 1)
                .attr('cx', (d) => d.projected.x)
                .attr('cy', (d) => d.projected.y);

            pointsSelection.exit().remove();

            /* ----------- LINKS ----------- */
            g.selectAll('line.link').remove();
            if (showLinks) {
                const linksSelection = g.selectAll('line.link').data(data[3]);

                linksSelection
                    .enter()
                    .append('line')
                    .attr('class', 'd3-3d link')
                    .merge(linksSelection)
                    .attr('stroke', 'black')
                    .attr('stroke-width', 1)
                    .attr('x1', (d) => d[0].projected.x)
                    .attr('y1', (d) => d[0].projected.y)
                    .attr('x2', (d) => d[1].projected.x)
                    .attr('y2', (d) => d[1].projected.y);

                linksSelection.exit().remove();
            }

            /* ----------- SOLUTIONS ----------- */
            Object.values(solutions).map((solution, i) => {
                g.selectAll(`line.solution_${solution.id}`).remove();
                if (selectedSolutions.includes(solution.id)) {
                    const solutionSelection = g.selectAll(`line.solution_${solution.id}`).data(data[4][i]);

                    solutionSelection
                        .enter()
                        .append('line')
                        .attr('class', `d3-3d solution_${solution.id}`)
                        .merge(solutionSelection)
                        .attr('stroke', getColorByIndex(solution.id))
                        .attr('stroke-width', 1)
                        .attr('x1', (d) => d[0].projected.x)
                        .attr('y1', (d) => d[0].projected.y)
                        .attr('x2', (d) => d[1].projected.x)
                        .attr('y2', (d) => d[1].projected.y);
                }
            });

            /* ----------- y-Scale ----------- */
            const yScaleSelection = g.selectAll('path.yScale').data(data[2]);

            yScaleSelection
                .enter()
                .append('path')
                .attr('class', 'd3-3d yScale')
                .merge(yScaleSelection)
                .attr('stroke', 'black')
                .attr('stroke-width', 0.5)
                .attr('d', yScale3d.draw);

            yScaleSelection.exit().remove();

            /* ----------- y-Scale Text ----------- */
            const yTextSelection = g.selectAll('text.yText').data(data[2][0]);

            yTextSelection
                .enter()
                .append('text')
                .attr('class', 'd3-3d yText')
                .attr('font-family', 'system-ui, sans-serif')
                .merge(yTextSelection)
                .each(function (d) {
                    d.centroid = { x: d.rotated.x, y: d.rotated.y, z: d.rotated.z };
                })
                .attr('x', (d) => d.projected.x)
                .attr('y', (d) => d.projected.y)
                .text((d) => (d.y <= 0 ? d.y : ''));

            yTextSelection.exit().remove();

            // Sort elements to prevent occlusion of smaller elements (this sometimes cause the zoom to rearrange elements)
            d3.selectAll('.d3-3d').sort(points3d.sort);
        }

        function updateData() {
            xGrid = [];
            scatter = [];
            yLine = [];
            linkLines = []; // Reset link data
            solutionsLines = [];

            let cnt = 0;

            for (let z = -j; z < j; z++) {
                for (let x = -j; x < j; x++) {
                    xGrid.push({ x: x, y: 1, z: z });
                }
            }

            scatter = Object.values(nodes).map((node) => {
                return {
                    x: node.x / 10,
                    y: node.y / 10,
                    z: node.z / 10,
                    id: node.id
                };
            });

            // Prepare link lines
            linkLines = links.map((link) => [
                {
                    x: nodes[link.source].x / 10,
                    y: nodes[link.source].y / 10,
                    z: nodes[link.source].z / 10
                },
                {
                    x: nodes[link.target].x / 10,
                    y: nodes[link.target].y / 10,
                    z: nodes[link.target].z / 10
                }
            ]);
            console.log(scatter);
            console.log(linkLines);

            Object.values(solutions).map((solution, i) => {
                let solutionLines = [];
                solution.routes.map((route) => {
                    // sort the stops by sequence
                    route.stops.sort((a, b) => a.sequence - b.sequence);
                    for (let i = 0; i < route.stops.length - 1; i++) {
                        const source = route.stops[i].node_id;
                        const target = route.stops[i + 1].node_id;
                        solutionLines.push([
                            {
                                x: nodes[source].x / 10,
                                y: nodes[source].y / 10,
                                z: nodes[source].z / 10
                            },
                            {
                                x: nodes[target].x / 10,
                                y: nodes[target].y / 10,
                                z: nodes[target].z / 10
                            }
                        ]);
                    }
                });

                solutionsLines.push(solutionLines);
            });

            d3.range(-1, 11, 1).forEach((d) => {
                yLine.push({ x: -j, y: -d, z: -j });
            });

            const data = [
                grid3d.scale(scale * zoomScale)(xGrid),
                points3d.scale(scale * zoomScale)(scatter),
                yScale3d.scale(scale * zoomScale)([yLine]),
                links3d.scale(scale * zoomScale)(linkLines), // Add link data
                Object.keys(solutions).map((solution_id, i) => {
                    return solutions3d[i].scale(scale * zoomScale)(solutionsLines[i]);
                })
            ];

            processData(data, 1000);
        }

        function dragStart(event) {
            mx = event.x;
            my = event.y;
        }

        function dragged(event) {
            beta = (event.x - mx + mouseX) * (Math.PI / 230);
            alpha = (event.y - my + mouseY) * (Math.PI / 230) * -1;

            const data = [
                grid3d.rotateY(beta + startAngle).rotateX(alpha - startAngle)(xGrid),
                points3d.rotateY(beta + startAngle).rotateX(alpha - startAngle)(scatter),
                yScale3d.rotateY(beta + startAngle).rotateX(alpha - startAngle)([yLine]),
                links3d.rotateY(beta + startAngle).rotateX(alpha - startAngle)(linkLines), // rotate links
                Object.keys(solutions).map((solution_id, i) => {
                    return solutions3d[i].rotateY(beta + startAngle).rotateX(alpha - startAngle)(solutionsLines[i]);
                })
            ];

            processData(data, 0);
        }

        function dragEnd(event) {
            mouseX = event.x - mx + mouseX;
            mouseY = event.y - my + mouseY;
        }

        updateData();

        return () => {
            svg.selectAll('*').remove(); // Cleanup on unmount
        };
    }, [nodes, links, showLinks, solutions, selectedSolutions]);

    useEffect(() => {
        // toggle links
        d3.select(gLinkRef.current).attr('stroke-opacity', showLinks ? 0.6 : 0.0);
    }, [showLinks]);

    return (
        <svg ref={containerRef}>
            <g ref={gLinkRef} />
        </svg>
    );
};

export default VRPVisualizer;
