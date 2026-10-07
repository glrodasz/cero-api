import { createServices } from "@cero/core";
import { createInMemoryRepositories } from "@cero/core/in-memory";
import { openMongoStorage } from "@cero/mongoose";
import { buildApp } from "./app.ts";
import { config } from "./config.ts";

// Composition root: choose the storage, build the use cases, hand them to Fastify.

const storage =
  config.storage === "memory"
    ? { repositories: createInMemoryRepositories(), close: async () => {} }
    : await openMongoStorage(config.mongodbUri);

const app = buildApp(createServices(storage.repositories), { logger: true });
app.addHook("onClose", storage.close);

await app.listen({ port: config.port, host: "0.0.0.0" });
app.log.info(`storage: ${config.storage}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void app.close());
}
