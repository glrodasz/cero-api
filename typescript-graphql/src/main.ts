import { createServices } from "@cero/core";
import { createInMemoryRepositories } from "@cero/core/in-memory";
import { openMongoStorage } from "@cero/mongoose";
import { createServer } from "node:http";
import { createApp } from "./app.ts";
import { config } from "./config.ts";

// Composition root: choose the storage, build the use cases, hand them to Yoga.

const storage =
  config.storage === "memory"
    ? { repositories: createInMemoryRepositories(), close: async () => {} }
    : await openMongoStorage(config.mongodbUri);

const yoga = createApp(createServices(storage.repositories));

const server = createServer(yoga).listen(config.port, () => {
  console.log(`typescript-graphql listening on http://localhost:${config.port}${yoga.graphqlEndpoint} (storage: ${config.storage})`);
});

const shutDown = () => server.close(() => void storage.close());
process.once("SIGINT", shutDown);
process.once("SIGTERM", shutDown);
