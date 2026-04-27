require('dotenv').config();
const app = require('./app');
const { createConnection } = require('./config/database');
const { getClient: getRedisClient } = require('./config/redis');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await createConnection();

    await getRedisClient();

    app.listen(PORT, () => {
      console.log(`\n Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(' Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();