import { MongoClient } from "../deps.ts";

const client = new MongoClient();

try {
  await client.connect("mongodb://mongodb:27017");
} catch (error) {
  console.log(error);
}

export { client };
