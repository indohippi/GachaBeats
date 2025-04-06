import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { Socket } from "net";
import { WebSocket as WS } from "ws";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";

// Constants
const MAX_32_BIT_INT = 0x7FFFFFFF; // Maximum 32-bit signed integer

// Helper function to ensure timeout values are within 32-bit limits
const getSafeTimeout = (value: number): number => Math.min(value, MAX_32_BIT_INT);

// Logging helper
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

// Startup sequence
async function startServer() {
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

    // Create HTTP server
    const server = createServer(app);

    // Register routes and initialize WebSocket server
    let wss;
    try {
      wss = registerRoutes(app);
      log('Routes registered successfully');
    } catch (routesError) {
      log(`Routes registration failed: ${routesError instanceof Error ? routesError.message : String(routesError)}`);
      throw routesError;
    }

    // Helper to access global WebSocket server
    const get_ws_server = () => {
      return (global as any).wss;
    };

    // Set up WebSocket upgrade handling
    server.on('upgrade', (request, socket: Socket, head) => {
      // Check if the request is for our WebSocket endpoint
      const pathname = new URL(request.url as string, 'http://localhost').pathname;
      
      if (pathname === '/ws') {
        log(`WebSocket upgrade request for ${pathname}`);
        
        // Set a reasonable timeout for the upgrade process
        socket.setTimeout(getSafeTimeout(10000)); // 10 second timeout for upgrade
        
        socket.on('error', (err) => {
          log(`Socket error during WebSocket upgrade: ${err.message}`);
          try {
            socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n');
          } catch (closeError) {
            log(`Error while closing socket: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
          } finally {
            socket.destroy();
          }
        });

        try {
          // Get WebSocket server from global context
          const wss = get_ws_server();
          
          if (!wss) {
            log('WebSocket server not initialized');
            socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n');
            socket.destroy();
            return;
          }
          
          wss.handleUpgrade(request, socket, head, (ws: WS) => {
            const wsConnectionId = Math.random().toString(36).substring(2, 9);
            const startTime = Date.now();
            
            log(`New WebSocket connection - ID: ${wsConnectionId}, StartTime: ${startTime}`);
            
            ws.on('error', (wsError: Error) => {
              log(`WebSocket error on connection ${wsConnectionId}: ${wsError.message}`);
              log(`Connection duration: ${Date.now() - startTime}ms`);
            });

            ws.on('close', () => {
              log(`WebSocket connection closed - ID: ${wsConnectionId}`);
              log(`Connection duration: ${Date.now() - startTime}ms`);
            });

            wss.emit('connection', ws, request);
          });
        } catch (wsError) {
          log(`WebSocket upgrade failed: ${wsError instanceof Error ? wsError.message : String(wsError)}`);
          try {
            socket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
          } catch (endError) {
            log(`Failed to end socket after upgrade error: ${endError instanceof Error ? endError.message : String(endError)}`);
          } finally {
            socket.destroy();
          }
        }
      } else {
        // Not a WebSocket request for our endpoint
        log(`Ignoring non-WebSocket upgrade request for ${pathname}`);
        socket.destroy();
      }
    });

    // Error handling middleware
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

    // Start server
    const PORT = parseInt(process.env.PORT || '5000', 10);
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running at http://0.0.0.0:${PORT}`);
    }).on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${PORT} is already in use`);
      }
      throw error;
    });

    // Graceful shutdown handler
    const shutdown = (signal: string) => {
      log(`Received ${signal}, starting graceful shutdown...`);
      server.close(() => {
        log('Server closed');
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        log('Forced shutdown after timeout');
        process.exit(1);
      }, getSafeTimeout(10000));
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (error) {
    log(`Fatal error during startup: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

startServer().catch(error => {
  log(`Unhandled error during server startup: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});