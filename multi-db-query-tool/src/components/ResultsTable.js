import React from 'react';
import './ResultsTable.css';

function ResultsTable({ results }) {
    if (!results || !results.columns || !results.rows || results.rows.length === 0) {
        return (
            <div className="results-container">
                <div className="result-stats">
                    Query executed successfully. No results returned.
                </div>
            </div>
        );
    }

    return (
        <div className="results-container">
            <div className="result-stats">
                Query executed in {results.executionTime}ms. {results.rowCount} rows returned.
            </div>

            <div className="results-table-container">
                <table>
                    <thead>
                    <tr>
                        {results.columns.map((column, index) => (
                            <th key={index}>{column}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {results.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex}>
                                    {cell === null ? (
                                        <em>NULL</em>
                                    ) : typeof cell === 'object' ? (
                                        JSON.stringify(cell)
                                    ) : (
                                        (cell).toString()
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default ResultsTable;