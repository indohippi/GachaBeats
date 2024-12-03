import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";

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

// Verify database connection
export async function verifyDatabaseConnection() {
  try {
    // Try a simple query to verify connection
    await db.select().from(schema.users).limit(1);
    console.log('✓ Database connection verified');
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Failed to connect to database. Please check your configuration.');
  }
}

// Initialize database (create tables if they don't exist)
export async function initializeDatabase() {
  try {
    await verifyDatabaseConnection();
    // Add any additional initialization logic here
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}
