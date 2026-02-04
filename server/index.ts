import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { runAutoSync } from "./services/social-tracker";
import { initializeRssFeeds, aggregateAllNews, saveArticlesToDatabase, getClientRelevanceContext } from "./services/news-aggregation";
import { db } from "./db";
import { clients } from "@shared/schema";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

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

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Seed database with sample data
  try {
    await seedDatabase();
  } catch (error) {
    console.error("Error seeding database:", error);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      // Start auto-sync scheduler - runs every 5 minutes to check for due syncs
      setInterval(async () => {
        try {
          await runAutoSync();
        } catch (error) {
          console.error("Auto-sync scheduler error:", error);
        }
      }, 5 * 60 * 1000); // Check every 5 minutes
      
      log("Auto-sync scheduler started");
      
      // Initialize RSS feeds and run initial news aggregation
      setTimeout(async () => {
        try {
          log("Initializing News Intelligence System...");
          await initializeRssFeeds();
          
          // Fetch news for all clients
          const allClients = await db.select().from(clients);
          if (allClients.length > 0) {
            const articles = await aggregateAllNews(168); // Last 7 days
            
            for (const client of allClients) {
              const context = await getClientRelevanceContext(client.id);
              const saved = await saveArticlesToDatabase(client.id, articles, context);
              log(`News aggregation: ${saved} articles saved for client ${client.name}`);
            }
          }
          
          log("News Intelligence System initialized");
        } catch (error) {
          console.error("News initialization error:", error);
        }
      }, 10000); // Wait 10 seconds after startup
      
      // Schedule hourly news aggregation
      setInterval(async () => {
        try {
          log("Running scheduled news aggregation...");
          const allClients = await db.select().from(clients);
          if (allClients.length > 0) {
            const articles = await aggregateAllNews(24); // Last 24 hours
            
            for (const client of allClients) {
              const context = await getClientRelevanceContext(client.id);
              await saveArticlesToDatabase(client.id, articles, context);
            }
          }
          log("Scheduled news aggregation complete");
        } catch (error) {
          console.error("Scheduled news aggregation error:", error);
        }
      }, 60 * 60 * 1000); // Every hour
    },
  );
})();
