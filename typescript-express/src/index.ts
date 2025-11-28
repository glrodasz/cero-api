import express, { type Application } from "express";
import mongoose from "mongoose";
import tasksRouter from "./features/tasks/tasks.router";
import focusSessionRouter from "./features/focusSessions/focusSessions.router";

const app: Application = express();

// Global middlewares
app.use(express.json());

// Routes
tasksRouter(app);
focusSessionRouter(app);

const port = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/cero";

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
