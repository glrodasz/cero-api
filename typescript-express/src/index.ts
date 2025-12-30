import express, { type Application, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import mongoose from "mongoose";
import tasksRouter from "./features/tasks/tasks.router.js";
import focusSessionRouter from "./features/focusSessions/focusSessions.router.js";

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

const port = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGODB_URI ?? "mongodb://root:root@127.0.0.1:27017/cero?authSource=admin";

const startServer = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

void startServer();
