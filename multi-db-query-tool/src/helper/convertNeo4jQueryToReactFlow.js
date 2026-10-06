/**
 * Converts Neo4j graph results to React Flow (xyflow) format
 * @param {Object} query - The Neo4j result object
 * @returns {Object} An object with nodes and edges formatted for React Flow
 */
function convertNeo4jQueryToReactFlow(query) {
    const neo4jNodes = query.nodes || [];
    const neo4jRelationships = query.relationships || [];

    const nodes = [];
    const edges = [];

    const nodePositions = {};

    neo4jNodes.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / neo4jNodes.length;
        const radius = 300;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        nodePositions[node.elementId] = { x, y };

        nodes.push({
            id: node.elementId,
            position: { x, y },
            data: {
                label: node.labels[0],
                properties: node.properties
            },
            type: 'default',
            style: {
                background: getNodeColor(node.labels[0]),
                color: '#fff',
                border: '1px solid #ddd',
                borderRadius: '5px',
                padding: '10px',
                width: 180,
            }
        });
    });

    neo4jRelationships.forEach(rel => {
        edges.push({
            id: rel.identity,
            source: rel.startNodeElementId,
            target: rel.endNodeElementId,
            label: rel.type,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#888' }
        });
    });

    return { nodes, edges };
}

/**
 * Helper function to generate different colors for different node types
 * @param {string} label - The node label
 * @returns {string} A hex color code
 */
function getNodeColor(label) {
    const colorMap = {
        'Drug': '#ff6b6b',
        'Date': '#48dbfb',
        'Seizures': '#1dd1a1',
        'Global_Location': '#5f27cd',
        'Source': '#ff9f43',
        'Spez_Location': '#54a0ff',
        'Transportation': '#00d2d3'
    };

    return colorMap[label] || '#777';
}

export default convertNeo4jQueryToReactFlow;