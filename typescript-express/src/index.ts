import express, { type Application, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import mongoose from "mongoose";
import tasksRouter from "./features/tasks/tasks.router.js";
import focusSessionRouter from "./features/focusSessions/focusSessions.router.js";
import config from "./config.js";

const app: Application = express();

// Global middlewares
app.use(cors());
app.use(express.json());

// Routes
tasksRouter(app);
focusSessionRouter(app);

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || "Internal server error" });
});

const startServer = async () => {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log("Connected to MongoDB");

    app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

void startServer();
