import React from 'react';
import './DatabaseSelector.css';

function DatabaseSelector({ activeDatabase, onDatabaseChange }) {
  return (
    <div className="db-selector">
      <div 
        className={`db-option ${activeDatabase === 'postgresql' ? 'active' : ''}`}
        onClick={() => onDatabaseChange('postgresql')}
      >
        <span className="db-icon postgresql-color"></span> PostgreSQL
      </div>
      <div 
        className={`db-option ${activeDatabase === 'neo4j' ? 'active' : ''}`}
        onClick={() => onDatabaseChange('neo4j')}
      >
        <span className="db-icon neo4j-color"></span> Neo4j
      </div>
      <div 
        className={`db-option ${activeDatabase === 'mongodb' ? 'active' : ''}`}
        onClick={() => onDatabaseChange('mongodb')}
      >
        <span className="db-icon mongodb-color"></span> MongoDB
      </div>
    </div>
  );
}

export default DatabaseSelector;
