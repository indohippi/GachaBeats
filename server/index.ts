import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [express] ${message}`);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

(async () => {
  try {
    // Initialize database first with enhanced error logging
    const { initializeDatabase, verifyDatabaseConnection } = await import("../db");
    try {
      await verifyDatabaseConnection();
      log("Database connection verified");
      await initializeDatabase();
      log("Database initialized successfully");
    } catch (dbError) {
      log(`Database initialization failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      throw dbError;
    }

    // Register routes after database is ready
    let wss;
    try {
      wss = registerRoutes(app);
      log("Routes registered successfully");
    } catch (routesError) {
      log(`Routes registration failed: ${routesError instanceof Error ? routesError.message : String(routesError)}`);
      throw routesError;
    }

    const server = createServer(app);

    // Set up WebSocket handling with error logging
    server.on('upgrade', (request, socket, head) => {
      try {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
          log('WebSocket connection established');
        });
      } catch (wsError) {
        log(`WebSocket upgrade failed: ${wsError instanceof Error ? wsError.message : String(wsError)}`);
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
    } else {
      serveStatic(app);
    }

    // Start server
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      log("Shutting down gracefully...");
      server.close(() => {
        log("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    log(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
})();
