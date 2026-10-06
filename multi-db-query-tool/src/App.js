import React, {useState} from 'react';
import './App.css';
import DatabaseSelector from './components/DatabaseSelector';
import ConnectionStatus from './components/ConnectionStatus';
import DatabaseEventListener from './components/DatabaseEventListener';
import AddDataButton from './components/AddDataButton';
import QueryTool from "./components/QueryTool";
import '@xyflow/react/dist/style.css';


function App() {
    const [activeDatabase, setActiveDatabase] = useState('postgresql');
    
    return (
        <div className="app">
            <header>
                <h1>Multi-Database Query Tool</h1>
                <ConnectionStatus/>
            </header>

            <DatabaseEventListener />

            <div className="outer-container">
                <DatabaseSelector
                    activeDatabase={activeDatabase}
                    onDatabaseChange={setActiveDatabase}
                />

                <AddDataButton dbType={activeDatabase} />

                <div className="database-container">
                    {activeDatabase === 'postgresql' && <QueryTool dbType={'postgresql'}/>}
                    {activeDatabase === 'neo4j' && <QueryTool dbType={'neo4j'}/>}
                    {activeDatabase === 'mongodb' && <QueryTool dbType={'mongodb'}/>}
                </div>
            </div>

        </div>

    );
}

export default App;
