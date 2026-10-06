import {Background, Controls, MiniMap, Panel, ReactFlow, useEdgesState, useNodesState} from "@xyflow/react";
import '@xyflow/react/dist/style.css';
import React, {useEffect, useState} from "react";
import convertNeo4jQueryToReactFlow from "../helper/convertNeo4jQueryToReactFlow";

function GraphQueryVisualization({neo4jData}) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (neo4jData && !isLoaded) {
            const {nodes: flowNodes, edges: flowEdges} = convertNeo4jQueryToReactFlow(neo4jData);
            setNodes(flowNodes);
            setEdges(flowEdges);
            setIsLoaded(true);
        }
    }, [neo4jData, isLoaded, setNodes, setEdges]);

    const nodeTypes = {};
    const edgeTypes = {};

    return (
        <div style={{width: '100%', height: '700px'}}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
            >
                <Background color="#f8f8f8" gap={16}/>
                <Controls/>
                <MiniMap
                    nodeStrokeColor={(n) => {
                        if (n.style?.background) return n.style.background;
                        return '#eee';
                    }}
                    nodeColor={(n) => {
                        if (n.style?.background) return n.style.background;
                        return '#fff';
                    }}
                    nodeBorderRadius={2}
                />
                <Panel position="top-left">
                    <div>
                        <strong>Nodes: </strong> {nodes.length} |
                        <strong> Relationships: </strong> {edges.length}
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}

export default GraphQueryVisualization;
