const {MongoClient, ObjectId} = require('mongodb');

class MongoDBService {
    constructor(uri, dbName) {
        this.uri = uri;
        this.dbName = dbName;
        this.isConnected = false;
        this.connect().catch(() => { /* Connection status is exposed by testConnection. */ });
    }

    async connect() {
        try {
            this.client = await MongoClient.connect(this.uri);
            this.db = this.client.db(this.dbName);
            this.isConnected = true;
            console.log(`Connected to MongoDB database: ${this.dbName}`);
        } catch (error) {
            console.error('MongoDB connection error:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
            this.isConnected = false;
            console.log('Disconnected from MongoDB');
        }
    }

    async testConnection() {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            await this.db.command({ping: 1});
            const serverInfo = await this.db.command({serverStatus: 1});

            return true;
        } catch (error) {
            console.error('MongoDB connection test failed:', error);
            return false;
        }
    }

    async getCollections() {
        try {
            if (!this.isConnected) {
                await this.connect();
            }

            const collections = await this.db.listCollections().toArray();
            const schema = {};

            for (const collection of collections) {
                const name = collection.name;
                schema[name] = [];

                // Get a sample document to infer schema
                const sampleDoc = await this.db.collection(name).findOne();

                if (sampleDoc) {
                    for (const [key, value] of Object.entries(sampleDoc)) {
                        schema[name].push({
                            name: key,
                            type: typeof value,
                            sample: value
                        });
                    }
                }
            }

            return {
                success: true,
                schema
            };
        } catch (error) {
            console.error('Error fetching MongoDB collections:', error);
            throw error;
        }
    }

    // New method: findOne to get a single document by query
    async findOne(collectionName, query = {}, options = {}) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }

            const result = await this.db.collection(collectionName).findOne(query, options);

            // Format the result
            if (result) {
                // Format special MongoDB types
                const formattedResult = this.formatDocumentForDisplay(result);
                return {
                    success: true,
                    document: formattedResult
                };
            } else {
                return {
                    success: false,
                    message: 'Document not found'
                };
            }
        } catch (error) {
            console.error(`Error executing findOne on collection ${collectionName}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Helper method to format MongoDB document types for display
    formatDocumentForDisplay(doc) {
        const formattedDoc = {};

        for (const [key, value] of Object.entries(doc)) {
            if (value && value._bsontype === 'ObjectId') {
                formattedDoc[key] = value.toString();
            } else if (value instanceof Date) {
                formattedDoc[key] = value.toISOString();
            } else if (value === null) {
                formattedDoc[key] = null;
            } else if (typeof value === 'object' && value !== null) {
                formattedDoc[key] = this.formatDocumentForDisplay(value);
            } else {
                formattedDoc[key] = value;
            }
        }

        return formattedDoc;
    }

    async executeQuery(queryString) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }

            const startTime = Date.now();
            let result;
            let resultType;

            // Check if the query is in MongoDB shell format (starts with db.)
            if (queryString.trim().startsWith('db.')) {
                // Parse MongoDB shell syntax
                const parsedQuery = this.parseShellQuery(queryString);

                console.log("Operation in Parsed", parsedQuery.type);

                if (parsedQuery.type === 'find') {
                    result = await this.db.collection(parsedQuery.collection)
                        .find(parsedQuery.filter || {})
                        .limit(parsedQuery.limit || 100)
                        .toArray();
                    resultType = 'find';
                } else if (parsedQuery.type === 'findOne') {
                    result = await this.db.collection(parsedQuery.collection)
                        .findOne(parsedQuery.filter || {});
                    result = result ? [result] : [];
                    resultType = 'findOne';
                } else if (parsedQuery.type === 'aggregate') {
                    result = await this.db.collection(parsedQuery.collection)
                        .aggregate(parsedQuery.pipeline)
                        .toArray();
                    resultType = 'aggregate';
                } else if (parsedQuery.type === 'count') {
                    result = await this.db.collection(parsedQuery.collection)
                        .countDocuments(parsedQuery.filter || {});
                    result = [{count: result}];
                    resultType = 'count';
                } else if (parsedQuery.type === 'insertOne') {
                    result = await this.db.collection(parsedQuery.collection)
                        .insertOne(parsedQuery.document);
                    result = [{
                        acknowledged: result.acknowledged,
                        insertedId: result.insertedId.toString(),
                        result: result
                    }];
                    resultType = 'insertOne';
                }
            } else {
                // Try to parse as JSON for backward compatibility
                try {
                    const query = JSON.parse(queryString);
                    const {collection, operation, filter = {}, projection = {}, limit = 100, sort = {}} = query;

                    if (!collection) {
                        throw new Error('Collection name is required');
                    }

                    if (!operation) {
                        throw new Error('Operation type is required (find, findOne, aggregate, etc.)');
                    }

                    console.log("Operation in JSON", operation);

                    switch (operation.toLowerCase()) {
                        case 'find':
                            result = await this.db.collection(collection)
                                .find(filter, {projection})
                                .sort(sort)
                                .limit(limit)
                                .toArray();
                            resultType = 'find';
                            break;

                        case 'findone':
                        case 'findOne':
                            result = await this.db.collection(collection)
                                .findOne(filter, {projection});
                            result = result ? [result] : [];
                            resultType = 'findOne';
                            break;

                        case 'aggregate':
                            if (!filter.pipeline) {
                                throw new Error('Aggregate operation requires a pipeline array');
                            }
                            result = await this.db.collection(collection)
                                .aggregate(filter.pipeline)
                                .toArray();
                            resultType = 'aggregate';
                            break;

                        case 'count':
                            result = await this.db.collection(collection).countDocuments(filter);
                            result = [{count: result}];
                            resultType = 'count';
                            break;

                        case 'insertOne':
                            result = await this.db.collection(collection).insertOne(document);
                            result = [{
                                acknowledged: result.acknowledged,
                                insertedId: result.insertedId.toString(),
                                result: result
                            }];
                            resultType = 'insertOne';
                            break;

                        default:
                            throw new Error(`Unsupported operation: ${operation}`);
                    }
                } catch (e) {
                    throw new Error('Invalid query format. Please provide a valid JSON query or MongoDB shell syntax (db.collection.operation()).');
                }
            }

            const executionTime = Date.now() - startTime;

            // Format the response
            if (resultType === 'find' || resultType === 'aggregate' || resultType === 'findOne') {
                // Get all unique keys from all documents
                const allKeys = new Set();
                result.forEach(doc => {
                    Object.keys(doc).forEach(key => allKeys.add(key));
                });

                const columns = Array.from(allKeys);

                // Convert documents to rows
                const rows = result.map(doc => {
                    return columns.map(col => {
                        const value = doc[col];

                        // Format ObjectId, Date, and other MongoDB types for display
                        if (value && value._bsontype === 'ObjectID') {
                            return value.toString();
                        } else if (value instanceof Date) {
                            return value.toISOString();
                        } else if (value === null) {
                            return 'null';
                        } else if (typeof value === 'object') {
                            return JSON.stringify(value);
                        } else {
                            return value;
                        }
                    });
                });

                return {
                    success: true,
                    columns,
                    rows,
                    executionTime,
                    rowCount: result.length
                };
            } else if (resultType === 'count') {
                return {
                    success: true,
                    count: result[0].count,
                    executionTime
                };
            } else if (resultType === 'insertOne') {
                return {
                    success: true,
                    inserted_Id: result.insertedId,
                    result: result,
                    executionTime
                };
            }
        } catch (error) {
            console.error('Error executing MongoDB query:', error);
            throw error;
        }
    }

    // Add this new method to parse MongoDB shell syntax
    parseShellQuery(queryString) {
        // Remove whitespace and ensure it starts with db.
        queryString = queryString.trim();
        if (!queryString.startsWith('db.')) {
            throw new Error('Invalid MongoDB shell query format. Must start with db.');
        }

        // Remove the 'db.' prefix
        queryString = queryString.substring(3);

        // Extract collection name
        const collectionMatch = queryString.match(/^(\w+)\./);
        if (!collectionMatch) {
            throw new Error('Invalid query format: collection name not found');
        }

        const collection = collectionMatch[1];
        queryString = queryString.substring(collection.length + 1);

        // Check for find queries
        if (queryString.startsWith('find(')) {
            let argsString = this.extractBetweenParentheses(queryString, 'find');
            let filter = {};
            let limit = undefined;

            if (argsString.includes('ObjectId(')) {
                // Replace ObjectId string representations with actual ObjectId instances
                argsString = argsString.replace(/ObjectId\(['"](.+?)['"]\)/g,
                    (match, id) => `new ObjectId("${id}")`);
            }

            // Check if there are arguments to find()
            if (argsString.trim() !== '') {
                try {
                    filter = eval(`(${argsString})`);
                } catch (e) {
                    console.error('Error parsing find arguments:', e);
                }
            }

            // Check for limit
            const remainingQuery = queryString.substring(queryString.indexOf('find(') + 'find('.length + argsString.length + 1).trim();
            if (remainingQuery.startsWith('.limit(')) {
                const limitMatch = remainingQuery.match(/\.limit\((\d+)\)/);
                if (limitMatch) {
                    limit = parseInt(limitMatch[1], 10);
                }
            }

            return {
                type: 'find',
                collection,
                filter,
                limit
            };
        }
        // Check for findOne queries
        else if (queryString.startsWith('findOne(')) {
            let argsString = this.extractBetweenParentheses(queryString, 'findOne');
            let filter = {};

            if (argsString.includes('ObjectId(')) {
                // Replace ObjectId string representations with actual ObjectId instances
                argsString = argsString.replace(/ObjectId\(['"](.+?)['"]\)/g,
                    (match, id) => `new ObjectId("${id}")`);
            }

            // Check if there are arguments to findOne()
            if (argsString.trim() !== '') {
                try {
                    filter = eval(`(${argsString})`);
                } catch (e) {
                    console.error('Error parsing findOne arguments:', e);
                }
            }

            return {
                type: 'findOne',
                collection,
                filter
            };
        }
        // Check for aggregate queries
        else if (queryString.startsWith('aggregate(')) {
            const argsString = this.extractBetweenParentheses(queryString, 'aggregate');
            let pipeline = [];

            try {
                pipeline = eval(`(${argsString})`);
            } catch (e) {
                console.error('Error parsing aggregate pipeline:', e);
            }

            return {
                type: 'aggregate',
                collection,
                pipeline
            };
        }
        // Check for count queries
        else if (queryString.startsWith('countDocuments(') || queryString.startsWith('count(')) {
            const method = queryString.startsWith('countDocuments(') ? 'countDocuments' : 'count';
            const argsString = this.extractBetweenParentheses(queryString, method);
            let filter = {};

            if (argsString.trim() !== '') {
                try {
                    filter = eval(`(${argsString})`);
                } catch (e) {
                    console.error('Error parsing count arguments:', e);
                }
            }

            return {
                type: 'count',
                collection,
                filter
            };
        } else if (queryString.startsWith('insertOne(')) {
            const argsString = this.extractBetweenParentheses(queryString, 'insertOne');
            let document = {};

            if (argsString.trim() !== '') {
                try {
                    document = eval(`(${argsString})`);
                } catch (e) {
                    console.error('Error parsing insertOne document:', e);
                    throw new Error('Invalid document format for insertOne operation');
                }
            } else {
                throw new Error('insertOne operation requires a document object');
            }

            return {
                type: 'insertOne',
                collection,
                document
            };
        }

        throw new Error('Unsupported query operation. Supported operations: find, findOne, aggregate, count, countDocuments');
    }

    extractBetweenParentheses(str, methodName) {
        const startIdx = str.indexOf(`${methodName}(`) + methodName.length + 1;
        let endIdx = startIdx;
        let openParens = 1;

        while (endIdx < str.length && openParens > 0) {
            if (str[endIdx] === '(') {
                openParens++;
            } else if (str[endIdx] === ')') {
                openParens--;
            }

            if (openParens > 0) {
                endIdx++;
            }
        }

        return str.substring(startIdx, endIdx);
    }
}

module.exports = MongoDBService;