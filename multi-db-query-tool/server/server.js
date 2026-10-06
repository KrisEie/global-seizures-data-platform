const http = require('http');
const socketIo = require('socket.io');
const KafkaService = require('./services/KafkaService');
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { required, mongoUri } = require('./config');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
//app.use(cors());
// Update your CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000', // Frontend URL
    credentials: true
}));


const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    }
});
io.on('connection', (socket) => {
    console.log('Client connected to Socket.IO');

    socket.on('disconnect', () => {
        console.log('Client disconnected from Socket.IO');
    });
});

const Neo4jService = require('./services/Neo4jService');
const MongoDBService = require('./services/MongoDBService');
const PostgreSQLService = require('./services/PostgreSQLService');
const kafkaService = new KafkaService();

const kafkaEventHandlers = {
    postgresql: async (event) => {
        console.log('Handling PostgreSQL event:', event.operation);
        io.emit('db-event', event);
    },
    mongodb: async (event) => {
        console.log('Handling MongoDB event:', event.operation);
        io.emit('db-event', event);
    },
    neo4j: async (event) => {
        console.log('Handling Neo4j event:', event.operation);
        io.emit('db-event', event);
    }
};

// Add health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({status: 'ok'});
});

app.get('/api/diagnostic', async (req, res) => {
    try {
        // Test database connection
        let dbStatus = "Unknown";
        let error = null;

        try {
            const result = await postgresService.pool.query('SELECT NOW() as time');
            dbStatus = `Connected, server time: ${result.rows[0].time}`;
        } catch (err) {
            dbStatus = "Failed";
            error = err.message;
        }

        // Return diagnostic information
        res.json({
            server: {
                status: "Running",
                environment: process.env.NODE_ENV,
                timestamp: new Date().toISOString()
            },
            database: {
                status: dbStatus,
                error: error,
                config: {
                    host: process.env.PG_HOST,
                    port: process.env.PG_PORT,
                    database: process.env.PG_DATABASE,
                    user: process.env.PG_USER
                }
            }
        });
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

const neo4jService = new Neo4jService(
    process.env.NEO4J_URI,
    process.env.NEO4J_USER,
    required('NEO4J_PASSWORD')
);

const mongoService = new MongoDBService(
    mongoUri(),
    process.env.MONGODB_DB || 'drug_seizures_db'
);

const postgresService = new PostgreSQLService({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: required('PG_PASSWORD'),
    port: process.env.PG_PORT
});

// PostgreSQL Routes
app.get('/api/postgresql/test-con', async (req, res) => {
    try {
        const result = await postgresService.testConnection();
        res.json({success: result});
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

app.post('/api/postgresql/query', async (req, res) => {
    const {query} = req.body;
    try {
        const result = await postgresService.executeQuery(query);

        // Publish the query event to Kafka
        const queryType = query.trim().toLowerCase().split(' ')[0];
        const operation = ['insert', 'update', 'delete'].includes(queryType)
            ? queryType.toUpperCase()
            : 'QUERY';

        await kafkaService.publishDatabaseChange(
            'postgresql',
            operation,
            { query, result: result.rows ? result.rows.length : 0 },
            getTableFromQuery(query)
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

app.get('/api/postgresql/schema', async (req, res) => {
    try {
        const schema = await postgresService.getSchema();
        res.json(schema);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// Neo4j Routes
app.get('/api/neo4j/test-con', async (req, res) => {
    try {
        const schema = await neo4jService.testConnection();
        res.json(schema);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

app.post('/api/neo4j/query', async (req, res) => {
    const {query} = req.body;
    try {
        let result;

        if (query.toLowerCase().includes('count')) {
            result = await neo4jService.executeTableQuery(query);
        } else {
            result = await neo4jService.executeGraphQuery(query);
        }

        // Publish the query event to Kafka
        const queryType = query.trim().toLowerCase().match(/^(create|match|delete|merge)/);
        const operation = queryType ? queryType[0].toUpperCase() : 'QUERY';

        await kafkaService.publishDatabaseChange(
            'neo4j',
            operation,
            { query, result }
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

app.get('/api/neo4j/schema', async (req, res) => {
    try {
        const schema = await neo4jService.getSchema();
        res.json(schema);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// MongoDB Routes
app.get('/api/mongodb/test-con', async (req, res) => {
    try {
        const schema = await mongoService.testConnection();
        res.json(schema);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

app.post('/api/mongodb/query', async (req, res) => {
    const {query} = req.body;
    try {
        const result = await mongoService.executeQuery(query);

        // Publish the query event to Kafka
        await kafkaService.publishDatabaseChange(
            'mongodb',
            'QUERY',
            {
                query,
                result: result },
            getCollectionFromQuery(query)
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

app.get('/api/mongodb/schema', async (req, res) => {
    try {
        const collections = await mongoService.getCollections();
        res.json(collections);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

server.listen(port, process.env.BIND_HOST || '127.0.0.1', async () => {
    console.log(`Server running on http://localhost:${port}`);

    // Connect to Kafka and start consumer
    try {
        await kafkaService.connectProducer();
        await kafkaService.startConsumer(kafkaEventHandlers);
        console.log('Kafka producer and consumer started');
    } catch (error) {
        console.error('Failed to start Kafka services:', error);
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await kafkaService.disconnect();
    await neo4jService.close();
    await mongoService.disconnect();
    await postgresService.disconnect();
    process.exit();
});


// Helper function
function getTableFromQuery(query) {
    // This is a very basic implementation and won't work for complex queries
    const match = query.match(/\b(from|into|update)\s+([a-zA-Z0-9_]+)/i);
    return match ? match[2] : 'unknown';
}

function getCollectionFromQuery(query) {
    try {
        if (typeof query === 'string') {
            // Try to parse if it's a string
            const parsedQuery = JSON.parse(query);
            return parsedQuery.collection || 'unknown';
        } else if (query.collection) {
            return query.collection;
        }
    } catch (e) {}
    return 'unknown';
}