import React, {useEffect, useState} from 'react';
import {io} from 'socket.io-client';
import './DatabaseEventListener.css';

function DatabaseEventListener() {
    const [events, setEvents] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Connect to the Socket.IO server
        const socket = io('http://localhost:5000', {
            withCredentials: true
        });

        // Connection events
        socket.on('connect', () => {
            setIsConnected(true);
            setError(null);
            console.log('Connected to Socket.IO server');
        });

        socket.on('connect_error', (err) => {
            setIsConnected(false);
            setError(`Connection error: ${err.message}`);
            console.error('Socket.IO connection error:', err);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            console.log('Disconnected from Socket.IO server');
        });

        // Listen for database events
        socket.on('db-event', (event) => {
            console.log('Received database event:', event);

            // Add new event to the list, keeping only the latest 10 events
            setEvents(prevEvents => {
                const newEvents = [event, ...prevEvents];
                return newEvents.slice(0, 10);
            });
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, []);

    const formatTime = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleTimeString();
    };

    const getBadgeClass = (operation) => {
        switch (operation?.toUpperCase()) {
            case 'INSERT':
                return 'badge-success';
            case 'UPDATE':
                return 'badge-warning';
            case 'DELETE':
                return 'badge-danger';
            case 'QUERY':
                return 'badge-info';
            default:
                return 'badge-secondary';
        }
    };

    const getDatabaseIcon = (database) => {
        switch (database?.toLowerCase()) {
            case 'postgresql':
                return '🐘'; // PostgreSQL elephant
            case 'mongodb':
                return '🍃'; // MongoDB leaf
            case 'neo4j':
                return '🔄'; // Neo4j graph
            default:
                return '💾'; // Generic database
        }
    };

    return (
        <div className="outer-container">
            <div className="events-header">
                <h3>Database Events Stream</h3>
                <span className={`stream-connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
                </span>
            </div>

            {error && <div className="error-message">{error}</div>}

            {events.length === 0 ? (
                <div className="no-events">
                    {isConnected ? 'Waiting for database events...' : 'Connect to see database events'}
                </div>
            ) : (
                <ul className="events-list">
                    {events.map((event, index) => (
                        <li key={index} className="event-item">
                            <div className="event-header">
                                <span className="database-icon">{getDatabaseIcon(event.database)}</span>
                                <span className="database-name">{event.database}</span>
                                <span className={`operation-badge ${getBadgeClass(event.operation)}`}>
                  {event.operation}
                </span>
                                <span className="event-time">{formatTime(event.timestamp)}</span>
                            </div>
                            <div className="event-details">
                                {event.table && <span className="event-table">Table: {event.table}</span>}
                                <pre className="event-data">{JSON.stringify(event.data, null, 2)}</pre>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default DatabaseEventListener;