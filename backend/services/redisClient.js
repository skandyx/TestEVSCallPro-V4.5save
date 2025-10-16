const redis = require('redis');
const logger = require('./logger');

const client = redis.createClient({
    // Lit l'URL de connexion depuis les variables d'environnement,
    // ce qui inclut le mot de passe pour l'authentification.
    url: process.env.REDIS_URL
});

client.on('error', err => {
    logger.logSystem('ERROR', 'Redis Client', `Redis Client Error: ${err.message}`);
    console.error('[Redis] Client Error', err);
});

client.on('connect', () => {
    logger.logSystem('INFO', 'Redis Client', 'Successfully connected to Redis.');
    console.log('[Redis] Client connected.');
});

client.on('reconnecting', () => {
    logger.logSystem('WARNING', 'Redis Client', 'Reconnecting to Redis...');
    console.log('[Redis] Client reconnecting...');
});

// Un client distinct est nécessaire pour les abonnements, car une fois en mode
// abonné, il ne peut effectuer que des commandes liées aux abonnements.
const subscriber = client.duplicate();

const connectClients = async () => {
    await Promise.all([
        client.connect(),
        subscriber.connect()
    ]);
};

const publish = (channel, message) => {
    // S'assure que le message est une chaîne de caractères pour la publication
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    client.publish(channel, messageStr);
};

const subscribe = (channel, callback) => {
    subscriber.subscribe(channel, (message) => {
        try {
            // Suppose que le message est du JSON et le parse
            const parsedMessage = JSON.parse(message);
            callback(parsedMessage);
        } catch (e) {
            // Si le parsing échoue, passe la chaîne brute
            callback(message);
        }
    });
};

const get = (key) => client.get(key);
const set = (key, value) => client.set(key, value);
const del = (key) => client.del(key);

module.exports = {
    connectClients,
    publish,
    subscribe,
    get,
    set,
    del,
};