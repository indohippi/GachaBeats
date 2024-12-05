import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import { Socket } from "net";

// Constants (ensuring 32-bit integer limits)
const STARTUP_TIMEOUT = 30 * 1000; // 30 seconds
const GRACEFUL_SHUTDOWN_TIMEOUT = 10 * 1000; // 10 seconds
const MAX_32_BIT_INT = 0x7FFFFFFF; // Maximum 32-bit signed integer

// Helper function to ensure timeout values are within 32-bit limits
const safeTimeout = (callback: () => void, delay: number) => {
  const safeDelay = Math.min(delay, MAX_32_BIT_INT);
  if (safeDelay !== delay) {
    console.warn(`Timeout value ${delay} exceeds 32-bit integer limit, capped to ${safeDelay}`);
  }
  return setTimeout(callback, safeDelay);
};

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [express] ${message}`);
}

// Verify required environment variables
function verifyEnvironment() {
  const requiredVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'PGHOST',
    'PGPORT',
    'PGUSER',
    'PGPASSWORD',
    'PGDATABASE'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  log('Environment variables verified');
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Startup sequence with timeout
async function startServer() {
  const startupPromise = new Promise(async (resolve, reject) => {
    try {
      log('Starting server initialization...');
      
      // Verify environment variables
      verifyEnvironment();

      // Initialize database
      const { initializeDatabase, verifyDatabaseConnection } = await import("../db");
      try {
        await verifyDatabaseConnection();
        log('Database connection verified');
        await initializeDatabase();
        log('Database initialized successfully');
      } catch (dbError) {
        log(`Database initialization failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        throw dbError;
      }

      // Register routes and initialize WebSocket server
      let wss;
      try {
        wss = registerRoutes(app);
        log('Routes registered successfully');
      } catch (routesError) {
        log(`Routes registration failed: ${routesError instanceof Error ? routesError.message : String(routesError)}`);
        throw routesError;
      }

      const server = createServer(app);

      // Set up WebSocket handling with enhanced error logging and cleanup
      const activeConnections = new Map();

      server.on('upgrade', (request, socket: Socket, head) => {
        // Prevent memory leaks from hanging connections
        socket.setTimeout(10000); // 10 second timeout for upgrade
        
        socket.on('error', (err) => {
          log(`Socket error during WebSocket upgrade: ${err.message}`);
          socket.destroy();
        });

        try {
          wss.handleUpgrade(request, socket, head, (ws) => {
            const connectionId = Math.random().toString(36).substr(2, 9);
            const connInfo = {
              id: connectionId,
              startTime: Date.now(),
              ip: request.socket.remoteAddress,
              url: request.url,
              headers: request.headers
            };
            
            activeConnections.set(ws, connInfo);
            log(`WebSocket connection established - ID: ${connectionId}`);
            
            // Log connection details
            log(`Connection details: ${JSON.stringify({
              id: connectionId,
              ip: connInfo.ip,
              userAgent: connInfo.headers['user-agent']
            })}`);

            // Add connection-specific error handling
            ws.on('error', (wsError) => {
              const conn = activeConnections.get(ws);
              log(`WebSocket error on connection ${conn?.id}: ${wsError.message}`);
              log(`Connection duration: ${Date.now() - (conn?.startTime || 0)}ms`);
            });

            ws.on('close', () => {
              const conn = activeConnections.get(ws);
              if (conn) {
                log(`WebSocket connection closed - ID: ${conn.id}`);
                log(`Connection duration: ${Date.now() - conn.startTime}ms`);
                activeConnections.delete(ws);
              }
            });

            wss.emit('connection', ws, request);
          });
        } catch (wsError) {
          log(`WebSocket upgrade failed: ${wsError instanceof Error ? wsError.message : String(wsError)}`);
          log(`Upgrade request details: ${JSON.stringify({
            path: request.url,
            headers: request.headers
          })}`);
          socket.destroy();
        }
      });

      // Enhanced error handling middleware
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        const stack = app.get('env') === 'development' ? err.stack : undefined;
        log(`Error [${status}]: ${message}`);
        if (stack) log(`Stack trace: ${stack}`);
        res.status(status).json({ message, stack });
      });

      // Setup Vite or static serving
      if (app.get("env") === "development") {
        await setupVite(app, server);
        log('Vite development server configured');
      } else {
        serveStatic(app);
        log('Static file serving configured');
      }

      // Start server with proper error handling
      const PORT = process.env.PORT || 5000;
      try {
        const port = Number(PORT);
        server.listen(port, "0.0.0.0", () => {
          log(`Server running at http://0.0.0.0:${port}`);
          resolve(server);
        }).on('listening', () => {
          log(`Server is listening on port ${port}`);
        }).on('error', (err: NodeJS.ErrnoException) => {
          log(`Server failed to start: ${err.message}`);
          reject(err);
        });

        server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            log(`Port ${PORT} is already in use`);
          }
          reject(error);
        });
      } catch (listenError) {
        log(`Failed to start server: ${listenError instanceof Error ? listenError.message : String(listenError)}`);
        throw listenError;
      }

      // Graceful shutdown handler
      const shutdown = async (signal: string) => {
        log(`Received ${signal}, starting graceful shutdown...`);
        
        const shutdownPromise = new Promise<void>((resolveShutdown) => {
          server.close(() => {
            log('Server closed');
            resolveShutdown();
          });
        });

        try {
          await Promise.race([
            shutdownPromise,
            new Promise((_, rejectShutdown) => 
              safeTimeout(() => rejectShutdown(new Error('Shutdown timeout')), GRACEFUL_SHUTDOWN_TIMEOUT)
            )
          ]);
          process.exit(0);
        } catch (error) {
          log(`Forced shutdown after timeout: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      };

      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));

    } catch (error) {
      reject(error);
    }
  });

  try {
    await Promise.race([
      startupPromise,
      new Promise((_, reject) => 
        safeTimeout(() => reject(new Error('Server startup timeout')), STARTUP_TIMEOUT)
      )
    ]);
  } catch (error) {
    log(`Fatal error during startup: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

startServer().catch(error => {
  log(`Unhandled error during server startup: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
