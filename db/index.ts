import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";

// Constants for database connection
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds
const CONNECTION_TIMEOUT = 10000; // 10 seconds

// Safe timeout helper (to avoid 32-bit integer overflow)
const MAX_32_BIT_INT = 0x7FFFFFFF; // Max positive 32-bit signed integer (2147483647)
const getSafeTimeout = (value: number): number => Math.min(value, MAX_32_BIT_INT);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create database instance with enhanced error handling
export const db = drizzle({
  connection: process.env.DATABASE_URL,
  schema,
  ws: ws,
});

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, getSafeTimeout(ms)));

// Verify database connection with timeout and retry logic
export async function verifyDatabaseConnection(retries = MAX_RETRIES): Promise<boolean> {
  try {
    console.log(`Attempting database connection (attempt ${MAX_RETRIES - retries + 1}/${MAX_RETRIES})...`);
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), getSafeTimeout(CONNECTION_TIMEOUT));
    });

    // Try a simple query to verify connection
    const connectionPromise = db.select().from(schema.users).limit(1);
    
    await Promise.race([connectionPromise, timeoutPromise]);
    console.log('✓ Database connection verified');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Database connection error (attempt ${MAX_RETRIES - retries + 1}/${MAX_RETRIES}):`, errorMessage);
    
    if (retries > 1) {
      console.log(`Retrying in ${RETRY_DELAY}ms...`);
      await delay(RETRY_DELAY);
      return verifyDatabaseConnection(retries - 1);
    }
    
    throw new Error(`Failed to connect to database after ${MAX_RETRIES} attempts: ${errorMessage}`);
  }
}

// Initialize database with enhanced error handling
export async function initializeDatabase() {
  try {
    console.log('Starting database initialization...');
    
    // Verify environment variables
    const requiredEnvVars = ['DATABASE_URL', 'PGUSER', 'PGHOST', 'PGDATABASE', 'PGPASSWORD', 'PGPORT'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Verify database connection with retries
    await verifyDatabaseConnection();
    
    // Additional initialization steps can be added here
    console.log('Database initialization completed successfully');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Database initialization failed:', errorMessage);
    throw error;
  }
}

// Export a connection health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await verifyDatabaseConnection(1); // Only try once for health check
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
