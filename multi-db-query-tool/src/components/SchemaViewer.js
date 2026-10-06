import React from 'react';
import './SchemaViewer.css';
import GraphSchemaVisualization from "./GraphSchemaVisualization";


function SchemaViewer({ schema, dbType }) {
    const tableNames = Object.keys(schema).sort();

    const renderPostgresSchema = () => {
        return tableNames.map((tableName) => {
            const table = schema[tableName];

            return (
                <div key={tableName} className="table-card">
                    <h3>{tableName}</h3>
                    <div className="column-list">
                        {table.map((column, index) => {
                            const isPk = column.name.endsWith('_id') &&
                                (column.name === `${tableName.replace('dim_', '').replace('fact_', '')}_id` ||
                                    column.name === 'id');
                            const isFk = column.name.endsWith('_id') && !isPk;

                            let columnDisplay = column.name;
                            if (isPk) columnDisplay += ' (PK)';
                            if (isFk) columnDisplay += ' (FK)';

                            return (
                                <div key={index} className="column-item">
                                    <span>{columnDisplay}</span>
                                    <span className="column-type">{column.type}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        });
    };

    const renderMongoDBSchema = () => {
        return tableNames.map((collectionName) => {
            const collection = schema[collectionName];

            return (
                <div key={collectionName} className="table-card">
                    <h3>{collectionName} ({collection.length} fields)</h3>
                    <div className="column-list">
                        {collection.map((field, index) => (
                            <div key={index} className="column-item">
                                <span className="field-name">{field.name}</span>
                                <span className="column-type">{field.type}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        });
    };

    const renderNeo4jSchema = () => {
        return (
            <div className="table-card">
                <h3>Neo4j Schema</h3>
                <GraphSchemaVisualization neo4jData={schema} />
            </div>
        );
    };

    const renderSchema = () => {
        switch (dbType.toLowerCase()) {
            case 'mongodb':
                return renderMongoDBSchema();
            case 'neo4j':
                return renderNeo4jSchema();
            case 'postgres' || 'postgresql':
            default:
                return renderPostgresSchema();
        }
    };

    return (
        <div className="schema-viewer">
            {renderSchema()}
        </div>
    );
}

export default SchemaViewer;