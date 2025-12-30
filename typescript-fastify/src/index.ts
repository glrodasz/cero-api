import Fastify from "fastify";
import cors from "@fastify/cors";
import mongoose from "mongoose";
import tasksRouter from "./features/tasks/tasks.router.js";
import focusSessionRouter from "./features/focusSessions/focusSessions.router.js";

const app = Fastify({ logger: true });

// Global error handler
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);
  reply.status(500).send({ message: error instanceof Error ? error.message : "Internal server error" });
});

app.register(cors);
app.register(tasksRouter, { prefix: "/tasks" });
app.register(focusSessionRouter, { prefix: "/focus-sessions" });

const port = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/cero";

const startServer = async () => {
  try {
    await mongoose.connect(mongoUri, {
      authSource: "admin",
      auth: {
        username: "root",
        password: "root",
      },
    });
    app.log.info("Connected to MongoDB");

    await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`Server is running on port ${port}`);
  } catch (error) {
    app.log.error("Failed to start server");
    app.log.error(error);
    process.exit(1);
  }
};

void startServer();

export default app;
