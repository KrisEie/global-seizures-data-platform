import React from 'react';
import './ResultsTable.css';
import GraphQueryVisualization from "./GraphQueryVisualization";

function ResultsGraph({ results }) {
    if (!results) {
        return (
            <div className="result-stats">
                Query executed successfully. No results returned.
            </div>
        );
    }

    return (
        <div>

            <div className="result-stats">
                Query executed in {results.executionTime}ms.
            </div>

            <div className="results-graph-container">
                <GraphQueryVisualization neo4jData={results.result} />
            </div>
        </div>
    );
}

export default ResultsGraph;