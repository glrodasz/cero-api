import { createInMemoryRepositories } from "../src/inMemory/index.ts";
import { testRepositoryContract } from "../src/testing/repositoryContract.ts";

testRepositoryContract("In-memory", async () => createInMemoryRepositories());
