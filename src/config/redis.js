const { createClient } = require('redis');
require('dotenv').config();

let client = null;
let isConnected = false;

const getClient = async () => {
  if (client && isConnected) return client;

  client = createClient({
    socket: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      reconnectStrategy: (retries) => {
        if (retries > 2) {
          console.warn('⚠️  Redis max reconnect attempts reached. Caching disabled.');
          return false; 
        }
        return Math.min(retries * 200, 2000);
      },
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB) || 0,
  });

  client.on('connect', () => {
    isConnected = true;
    console.log('✅ Redis connected');
  });

  client.on('error', (err) => {
    isConnected = false;
    console.warn('⚠️  Redis error (caching degraded):', err.message);
  });

  client.on('end', () => {
    isConnected = false;
  });

  try {
    await client.connect();
  } catch (err) {
    console.warn('⚠️  Redis connection failed (caching disabled):', err.message);
    isConnected = false;
  }

  return client;
};


const cacheGet = async (key) => {
  try {
    const c = await getClient();
    if (!isConnected) return null;
    const value = await c.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const cacheSet = async (key, value, ttlSeconds) => {
  try {
    const c = await getClient();
    if (!isConnected) return;
    await c.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch {
    return null;
  }
};

const cacheDel = async (...keys) => {
  try {
    const c = await getClient();
    if (!isConnected) return;
    for (const key of keys) {
      if (key.includes('*')) {
        let cursor = 0;
        do {
          const { cursor: nextCursor, keys: found } = await c.scan(cursor, {
            MATCH: key,
            COUNT: 100,
          });
          cursor = nextCursor;
          if (found.length) await c.del(found);
        } while (cursor !== 0);
      } else {
        await c.del(key);
      }
    }
  } catch {
    return null;
  }
};

const invalidateTeacherCache = async (teacherId) => {
  await cacheDel(
    `live:teacher:${teacherId}:*`,  // all subject variants
    `live:teacher:${teacherId}`      // the no-subject key
  );
};

module.exports = { getClient, cacheGet, cacheSet, cacheDel, invalidateTeacherCache };