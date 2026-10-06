const {Pool} = require('pg');

class PostgreSQLService {
    constructor(config) {
        console.log('Initializing PostgreSQL connection with config:', {
            user: config.user,
            host: config.host,
            database: config.database,
            port: config.port,
            // Password omitted for security
        });

        this.pool = new Pool(config);

        // Handle pool errors to prevent application crashes
        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle PostgreSQL client', err);
        });
    }

    async executeQuery(query) {
        const startTime = Date.now();

        try {
            // Basic security checks
            const queryLower = query.toLowerCase().trim();

            const result = await this.pool.query(query);
            const executionTime = Date.now() - startTime;

            return {
                success: true,
                executionTime,
                rowCount: result.rowCount,
                columns: result.fields.map(field => field.name),
                rows: result.rows.map(row =>
                    result.fields.map(field => row[field.name])
                )
            };
        } catch (error) {
            console.error('PostgreSQL Query Error:', error);
            throw error;
        }
    }

    async getSchema() {
        const schemaQuery = `
            SELECT table_name,
                   column_name,
                   data_type,
                   is_nullable,
                   column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        `;

        try {
            const result = await this.pool.query(schemaQuery);
            const schema = {};

            result.rows.forEach(row => {
                if (!schema[row.table_name]) {
                    schema[row.table_name] = [];
                }

                schema[row.table_name].push({
                    name: row.column_name,
                    type: row.data_type,
                    nullable: row.is_nullable === 'YES',
                    default: row.column_default
                });
            });

            return {success: true, schema: schema};
        } catch (error) {
            console.error('PostgreSQL Schema Error:', error);
            throw error;
        }
    }

    async testConnection(retries = 5, delay = 2000) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Connection attempt ${attempt}/${retries}`);
                const result = await this.pool.query('SELECT NOW() as time');
                console.log('PostgreSQL connection successful:', result.rows[0]);
                return true;
            } catch (error) {
                console.error(`Attempt ${attempt}: Connection failed:`, error.message);
                if (attempt < retries) {
                    console.log(`Retrying in ${delay/1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error('All connection attempts failed');
                    return false;
                }
            }
        }
    }

    async disconnect() {
        try {
            await this.pool.end();
            console.log('PostgreSQL pool has been closed');
        } catch (error) {
            console.error('Error during PostgreSQL disconnection:', error);
        }
    }
}

module.exports = PostgreSQLService;
