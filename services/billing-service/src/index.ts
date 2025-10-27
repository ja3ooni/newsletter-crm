import dotenv from 'dotenv';
import { BillingApp } from './app';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables', { missingEnvVars });
  process.exit(1);
}

// Start the application
async function main(): Promise<void> {
  try {
    const app = new BillingApp();
    const port = parseInt(process.env.PORT || '3005', 10);

    await app.start(port);
  } catch (error) {
    logger.error('Failed to start application', { error: error.message });
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Application startup failed', { error: error.message });
  process.exit(1);
});
