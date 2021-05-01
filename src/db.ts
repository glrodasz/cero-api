import { MongoClient } from "../deps.ts";

const client = new MongoClient();

try {
  await client.connect("mongodb://localhost:27017");
} catch (error) {
  console.log(error);
}

export { client };
