// Read local configuration without storing or logging connection credentials.
function required(name) {
    const value = process.env[name];
    if (!value || value.startsWith('REPLACE_')) {
        throw new Error(`Set ${name} in the repository-root .env file before starting.`);
    }
    return value;
}
function mongoUri() {
    if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
    const user = encodeURIComponent(required('MONGODB_USER'));
    const password = encodeURIComponent(required('MONGODB_PASSWORD'));
    const host = process.env.MONGODB_HOST || '127.0.0.1';
    const port = process.env.MONGODB_PORT || '27017';
    const authSource = encodeURIComponent(process.env.MONGODB_AUTH_SOURCE || 'admin');
    return `mongodb://${user}:${password}@${host}:${port}/?authSource=${authSource}`;
}
module.exports = { required, mongoUri };
