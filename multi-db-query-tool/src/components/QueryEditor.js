import React, {useState} from 'react';
import './QueryEditor.css';

function QueryEditor({sampleQueries, scenarios, onExecuteQuery, isLoading, dbType}) {
    const [query, setQuery] = useState('');

    const handleSampleQuery = (sampleQuery) => {
        setQuery(sampleQuery);
    };

    const handleExecute = () => {
        onExecuteQuery(query);
    };

    const handleKeyDown = (e) => {
        // Execute query on Ctrl+Enter or Cmd+Enter
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleExecute();
        }
    };

    return (
        <div className="query-editor">
            <div className="query-sections">
                {/* Sample Queries Section */}
                <div className="query-section">
                    <h3 className="section-header">Sample Queries</h3>
                    <div className="sample-queries">
                        {sampleQueries.map((sq, index) => (
                            <div
                                key={`sample-${index}`}
                                className="query-item"
                                onClick={() => handleSampleQuery(sq)}
                            >
                                {sq}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Scenarios Section */}
                {scenarios && (
                    <div className="query-section">
                        <h3 className="section-header">Scenario: {scenarios.title}</h3>
                        <p className="scenario-description">{scenarios.description}</p>
                        <div className="scenario-queries">
                            {scenarios.queries.map((sq, index) => (
                                <div
                                    key={`scenario-${scenarios.id}-query-${index}`}
                                    className="query-item"
                                    onClick={() => handleSampleQuery(sq)}
                                >
                                    {sq}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="query-container">
                <h3 className="section-header">Enter Query</h3>
                <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Enter your ${dbType} query here...`}
                    disabled={isLoading}
                />
                <div className="query-actions">
                    <button
                        onClick={handleExecute}
                        disabled={isLoading}
                        className="execute-button"
                    >
                        {isLoading ? 'Executing...' : 'Execute Query'}
                    </button>
                    <div className="shortcut-hint">
                        Press Ctrl+Enter to execute
                    </div>
                </div>
            </div>
        </div>
    );
}

export default QueryEditor;