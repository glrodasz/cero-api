import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.ts";
import { config } from "./config.ts";

// Composition root: pick the storage; Nest builds everything else from the module graph.

const app = await NestFactory.create(AppModule.forRoot(config));
app.enableCors();
app.enableShutdownHooks(); // SIGINT/SIGTERM run onApplicationShutdown, which closes the database connection

await app.listen(config.port);
Logger.log(`typescript-nest listening on http://localhost:${config.port} (storage: ${config.storage})`, "Bootstrap");
