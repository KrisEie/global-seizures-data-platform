import React, {useEffect, useState} from 'react';
import QueryEditor from './QueryEditor';
import ResultsTable from './ResultsTable';
import SchemaViewer from './SchemaViewer';
import './QueryTool.css';
import {ApiUrl} from '../api';
import ResultsGraph from "./ResultsGraph";

function getSampleQueries(dbType) {
    switch (dbType) {
        case 'postgresql':
        case 'postgres':
            return [
                'SELECT * FROM fact_seizures LIMIT 10;',
                'SELECT COUNT(*) FROM fact_seizures;',
                'SELECT * FROM fact_seizures WHERE seizure_id = (SELECT last_value FROM fact_seizures_seizure_id_seq);'
            ];
        case 'neo4j':
            return [
                'MATCH (n) RETURN n LIMIT 10',
                'MATCH (s:Seizures) RETURN COUNT(s)',
                'MATCH (n:Seizures {seizure_id: 10001.0}) RETURN n;'
            ];
        case 'mongodb':
            return [
                'db.seizures.find().limit(10)',
                'db.seizures.findOne({ "_id": ObjectId("680797abfd1bdac8ddcab17b") })'
            ];
        default:
            return [];
    }
}

function getScenario(dbType) {
    switch (dbType) {
        case 'postgresql':
        case 'postgres':
            return {
                id: 'colombia-drug-profile',
                title: 'Colombian City Drug Profile: Frequency and Quantity Analysis',
                description: 'This city-level drug profile provides Colombian authorities with actionable intelligence to optimize their domestic counter-narcotics efforts and identify the most significant local drug threats in each urban center.',
                queries: [
                    `SELECT sl.city,
    sl.administrative_region,
    dr.drug_substance,
    COUNT(f.seizure_id) as seizure_frequency,
    SUM(f.quantity)     as total_quantity,
    dr.measurement_unit
FROM fact_seizures f
      JOIN
  dim_global_location gl ON f.global_location_id = gl.global_location_id
      JOIN
  dim_spez_location sl ON f.spez_location_id = sl.spez_location_id
      JOIN
  dim_drug dr ON f.drug_id = dr.drug_id
      JOIN
  dim_transportation t ON f.transport_id = t.transport_id
WHERE gl.country = 'Colombia'
GROUP BY sl.city, sl.administrative_region, dr.drug_substance, dr.measurement_unit
ORDER BY sl.city, seizure_frequency DESC, total_quantity DESC;`
                ]
            };
        case 'neo4j':
            return {
                id: 'border-control',
                title: 'Border Control Officer Tracking Drug Smuggling Methods',
                description: 'A customs officer at a major airport wants to know the most common drug smuggling methods to improve detection efforts..',
                queries: [
                    `MATCH (t:Transportation)
RETURN t.transportation_mode AS Transport_Mode, COUNT(t) AS c
ORDER BY c DESC;`
                ]
            };
        case 'mongodb':
            return {
                id: 'temporal-analysis',
                title: 'Temporal Patterns in Drug Seizures',
                description: 'This analysis examines time-based patterns in seizure data, identifying seasonal trends and changes over time.',
                queries: [
                    `db.seizures.aggregate([
  {
    $match: {
      "Measurement Unit": { $regex: "plant", $options: "i" },
      "Seizure Date": { $gte: "2015-01-01", $lt: "2025-01-01" }
    }
  },
  {
    $group: {
      _id: "$Country/Territory of Seizure",
      total_quantity: { $sum: "$Quantity Seized" },
      total_seizures: { $sum: 1 },
      distinct_substances: { $addToSet: "$Drug/Substance" },
      measurement_unit: { $first: "$Measurement Unit" }
    }
  },
  {
    $sort: { total_quantity: -1 }
  },
  {
    $limit: 20
  },
  {
    $project: {
      _id: 0,
      country: "$_id",
      total_quantity: 1,
      total_seizures: 1,
      distinct_substances: 1,
      measurement_unit: 1
    }
  }
])`
                ]
            };
        default:
            return [];
    }
}

function getQueryEndpoint(dbType) {
    switch (dbType) {
        case 'postgresql':
            return "/api/postgresql/query";
        case 'neo4j':
            return "/api/neo4j/query";
        case 'mongodb':
            return "/api/mongodb/query";
        default:
            return "";
    }
}

function getSchemaEndpoint(dbType) {
    switch (dbType) {
        case 'postgresql':
        case 'postgres':
            return "/api/postgresql/schema";
        case 'neo4j':
            return "/api/neo4j/schema";
        case 'mongodb':
            return "/api/mongodb/schema";
        default:
            return "";
    }
}

function QueryTool({dbType}) {
    const [activeTab, setActiveTab] = useState('query');
    const [schema, setSchema] = useState(null);
    const [queryResults, setQueryResults] = useState(null);
    const [isGraph, setIsGraph] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const sampleQueries = getSampleQueries(dbType);
    const scenario = getScenario(dbType);
    const schemaUrl = `${ApiUrl()}${getSchemaEndpoint(dbType)}`;
    const queryUrl = `${ApiUrl()}${getQueryEndpoint(dbType)}`;

    useEffect(() => {
        if (!schema && activeTab === 'schema') {
            fetchSchema();
        }
    }, [activeTab]);

    useEffect(() => {
        setSchema(null);
        setQueryResults(null);
        setError(null);
    }, [dbType]);

    const fetchSchema = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(schemaUrl);
            const data = await response.json();

            if (data.success) {
                setSchema(data.schema);
            } else {
                throw new Error(data.error || `Failed to fetch ${dbType} schema`);
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const executeQuery = async (query) => {
        if (!query.trim()) {
            setError('Please enter a query');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch(queryUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({query})
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
            }

            if (dbType === 'neo4j') {
                setIsGraph(data.isGraph);
            }
            setQueryResults(data);
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="query-tool">
            <div className="tab-container">
                <div
                    className={`tab ${activeTab === 'query' ? 'active' : ''}`}
                    onClick={() => setActiveTab('query')}
                >
                    Query Tool
                </div>
                <div
                    className={`tab ${activeTab === 'schema' ? 'active' : ''}`}
                    onClick={() => setActiveTab('schema')}
                >
                    Schema
                </div>
            </div>

            {activeTab === 'query' ? (
                <div className="query-tab">
                    <QueryEditor
                        sampleQueries={sampleQueries}
                        scenarios={scenario}
                        onExecuteQuery={executeQuery}
                        isLoading={isLoading}
                        dbType={dbType}
                    />

                    {error && <div className="error">{error}</div>}

                    {isLoading && (
                        <div className="loading-container">
                            <div className="loading">Executing query...</div>
                        </div>
                    )}

                    {queryResults && !error && !isLoading && (
                        <div className="results-container">
                            {isGraph ? (
                                <ResultsGraph results={queryResults}/>
                            ) : (
                                <ResultsTable results={queryResults}/>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="schema-tab">
                    {isLoading ? (
                        <div className="loading">Loading {dbType} schema...</div>
                    ) : error ? (
                        <div className="error">{error}</div>
                    ) : schema ? (
                        <SchemaViewer schema={schema} dbType={dbType}/>
                    ) : (
                        <div className="info-message">
                            Click "Schema" to load the database schema
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default QueryTool;