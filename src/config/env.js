const dotenv = require('dotenv');

dotenv.config();

const requiredVars = ['JWT_SECRET', 'SESSION_SECRET', 'DATABASE_URL'];
const missingVars = requiredVars.filter((name) => !process.env[name] || String(process.env[name]).trim() === '');
if (process.env.NODE_ENV === 'production' && (!process.env.CORS_ORIGIN || !String(process.env.CORS_ORIGIN).trim())) {
  missingVars.push('CORS_ORIGIN');
}
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

const databaseUrl = String(process.env.DATABASE_URL).replace(/^['"]|['"]$/g, '').trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL must not be empty');
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: String(process.env.SESSION_SECRET).trim(),
  jwtSecret: String(process.env.JWT_SECRET).trim(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  appName: process.env.APP_NAME || 'Vanguard Services',
  databaseUrl,
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
