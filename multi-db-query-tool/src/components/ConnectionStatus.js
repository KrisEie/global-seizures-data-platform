import React, {useEffect, useState} from 'react';
import './ConnectionStatus.css';
import {ApiUrl} from "../api";

function getConnectionEndpoint(dbType) {
    switch (dbType) {
        case 'postgresql' || 'postgres':
            return "/api/postgresql/test-con";
        case 'neo4j':
            return "/api/neo4j/test-con";
        case 'mongodb':
            return "/api/mongodb/test-con";
        default:
            return "";
    }
}


function ConnectionStatus() {
    const [init, setInit] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState({
        postgresql: false,
        neo4j: false,
        mongodb: false
    });

    const checkConnection = async (dbType) => {
        try {
            const response = await fetch(`${ApiUrl()}${getConnectionEndpoint(dbType)}`);
            setConnectionStatus(prev => ({...prev, [dbType]: response.ok}));
        } catch (error) {
            console.error(`Error checking ${dbType} connection:`, error);
            setConnectionStatus(prev => ({...prev, [dbType]: false}));
        }
    };

    useEffect(() => {
        if (!init) {
            setInit(true)
            checkConnection('postgresql');
            checkConnection('neo4j');
            checkConnection('mongodb');
        }
    }, [init]);


    return (
        <div className="connection-status">
            <div className={`status-item ${connectionStatus.postgresql ? 'connected' : 'disconnected'}`}>
                PostgreSQL: {connectionStatus.postgresql ? 'Connected' : 'Disconnected'}
            </div>
            <div className={`status-item ${connectionStatus.neo4j ? 'connected' : 'disconnected'}`}>
                Neo4j: {connectionStatus.neo4j ? 'Connected' : 'Disconnected'}
            </div>
            <div className={`status-item ${connectionStatus.mongodb ? 'connected' : 'disconnected'}`}>
                MongoDB: {connectionStatus.mongodb ? 'Connected' : 'Disconnected'}
            </div>
        </div>
    );
}

export default ConnectionStatus;