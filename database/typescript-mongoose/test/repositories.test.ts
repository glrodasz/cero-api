import { testRepositoryContract } from "@cero/core/testing";
import type { Connection } from "mongoose";
import { after, describe } from "node:test";
import { connectMongo, createMongooseRepositories } from "../src/index.ts";

// Runs against a real MongoDB: `docker compose up -d mongo` from the repository root.
// A throwaway database keeps the test run away from your development data.
const mongodbUri = process.env.MONGODB_TEST_URI ?? "mongodb://root:root@127.0.0.1:27017/cero_typescript_test?authSource=admin";

describe("MongoDB adapter", { skip: process.env.SKIP_DATABASE_TESTS === "1" && "SKIP_DATABASE_TESTS=1" }, () => {
  let connection: Connection | undefined;

  after(async () => {
    await connection?.dropDatabase();
    await connection?.close();
  });

  testRepositoryContract("MongoDB", async () => {
    connection ??= await connectMongo(mongodbUri);
    await connection.dropDatabase();
    return createMongooseRepositories(connection);
  });
});
