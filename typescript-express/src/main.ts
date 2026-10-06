import { createServices } from "@cero/core";
import { createInMemoryRepositories } from "@cero/core/in-memory";
import { openMongoStorage } from "@cero/mongoose";
import { createApp } from "./app.ts";
import { config } from "./config.ts";

// Composition root: choose the storage, build the use cases, hand them to Express.

const storage =
  config.storage === "memory"
    ? { repositories: createInMemoryRepositories(), close: async () => {} }
    : await openMongoStorage(config.mongodbUri);

const app = createApp(createServices(storage.repositories));

const server = app.listen(config.port, () => {
  console.log(`typescript-express listening on http://localhost:${config.port} (storage: ${config.storage})`);
});

const shutDown = () => server.close(() => void storage.close());
process.once("SIGINT", shutDown);
process.once("SIGTERM", shutDown);
