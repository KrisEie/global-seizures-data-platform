const neo4j = require('neo4j-driver');

class Neo4jService {
    constructor(uri, username, password) {
        if (!uri || !username || !password) {
            throw new Error('Set NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD before starting.');
        }
        this.uri = uri;
        this.username = username;
        this.password = password;
        this.initializeDriver();
    }

    initializeDriver() {
        try {
            this.driver = neo4j.driver(
                this.uri,
                neo4j.auth.basic(this.username, this.password),
                {
                    encrypted: 'ENCRYPTION_OFF'
                }
            );
            console.log('Neo4j driver initialized successfully');
        } catch (error) {
            console.error('Error initializing Neo4j driver:', error);
            throw error;
        }
    }

    async executeTableQuery(query, params = {}) {
        const session = this.driver.session();

        try {
            const startTime = Date.now();
            const result = await session.run(query, params);
            const executionTime = Date.now() - startTime;

            if (!result.records || result.records.length === 0) {
                return {
                    success: true,
                    executionTime,
                    rowCount: 0,
                    columns: [],
                    rows: [],
                    isGraph: false
                };
            }

            const rows = result.records.map(record => {
                return record._fields.map(field => {
                    if (field && typeof field === 'object' && 'low' in field && 'high' in field) {
                        return field.low;
                    }
                    return field;
                });
            });

            return {
                success: true,
                executionTime,
                rowCount: result.records.length,
                columns: result.records[0].keys,
                rows: rows,
                isGraph: false
            };

        } catch (error) {
            // Check for credentials expired error and try to fix it
            if (error.code === 'Neo.ClientError.Security.CredentialsExpired') {
                const passwordChanged = await this.changePassword();
                if (passwordChanged) {
                    // Try the query again
                    return this.executeTableQuery(query, params);
                }
            }

            console.error('Neo4j Query Error:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async executeGraphQuery(query, params = {}) {
        const session = this.driver.session();

        try {
            const startTime = Date.now();
            const result = await session.run(query, params);
            const executionTime = Date.now() - startTime;

            const nodesMap = new Map();
            let relationships = [];

            result.records.forEach(record => {
                const fieldsArray = record._fields;
                if (!fieldsArray || !Array.isArray(fieldsArray)) return;

                fieldsArray.forEach(field => {
                    if (field && field.identity && field.labels) {
                        const nodeId = field.identity.low;
                        if (!nodesMap.has(nodeId)) {
                            nodesMap.set(nodeId, {
                                identity: nodeId,
                                labels: field.labels,
                                properties: field.properties,
                                elementId: field.elementId
                            });
                        }
                    }
                });

                if (fieldsArray.length > 1) {
                    const sourceNode = fieldsArray[0];
                    if (sourceNode && sourceNode.identity) {
                        for (let i = 1; i < fieldsArray.length; i++) {
                            const targetNode = fieldsArray[i];
                            if (targetNode && targetNode.identity) {
                                relationships.push({
                                    identity: `${sourceNode.identity.low}_${targetNode.identity.low}`,
                                    startNodeElementId: sourceNode.elementId,
                                    endNodeElementId: targetNode.elementId,
                                    type: ``
                                });
                            }
                        }
                    }
                }
            });

            const nodes = Array.from(nodesMap.values());

            return {
                success: true,
                executionTime,
                isGraph: true,
                result: { nodes, relationships }
            };

        } catch (error) {
            // Check for credentials expired error and try to fix it
            if (error.code === 'Neo.ClientError.Security.CredentialsExpired') {
                const passwordChanged = await this.changePassword();
                if (passwordChanged) {
                    // Try the query again
                    return this.executeGraphQuery(query, params);
                }
            }

            console.error('Neo4j Query Error:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async getSchema() {
        const session = this.driver.session();

        try {
            const result = await session.run('CALL db.schema.visualization()');
            const nodes = result.records.map(record => record.get('nodes'));
            const relationships = result.records.map(record => record.get('relationships'));

            return {success: true, schema:{nodes, relationships}};
        } catch (error) {
            // Check for credentials expired error and try to fix it
            if (error.code === 'Neo.ClientError.Security.CredentialsExpired') {
                const passwordChanged = await this.changePassword();
                if (passwordChanged) {
                    // Try the query again
                    return this.getSchema();
                }
            }

            console.error('Neo4j Schema Error:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async changePassword() {
        console.error('Update expired Neo4j credentials in Neo4j Browser, then update .env and restart.');
        return false;
    }

    async close() {
        if (this.driver) {
            await this.driver.close();
        }
    }

    async testConnection() {
        const session = this.driver.session();
        try {
            console.log('Testing Neo4j connection...');
            await session.run('RETURN "Neo4j is connected" AS message');
            console.log('Neo4j connection successful');
            return true;
        } catch (error) {
            // Check for credentials expired error and try to fix it
            if (error.code === 'Neo.ClientError.Security.CredentialsExpired') {
                console.log('Neo4j credentials expired. Attempting to change password...');
                const passwordChanged = await this.changePassword();
                if (passwordChanged) {
                    // Try the connection test again
                    return this.testConnection();
                }
            }

            console.error('Neo4j connection error:', error);
            return false;
        } finally {
            await session.close();
        }
    }
}

module.exports = Neo4jService;