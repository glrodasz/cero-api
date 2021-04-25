import { App } from "./app.ts";
import { client } from "./db.ts";

const PORT = 8080;

const app = new App(PORT);

app.use(() => {
  console.log("This is a middleware");
});

app.get("/helloWorld", (_req, res) => {
  res.send("Hello World");
});

app.get("/", async (_req, res) => {
  interface Entry {
    date: string;
  }
  const db = client.database("test");
  const entries = db.collection<Entry>("entries");
  await entries.insertOne({ date: new Date() });
  res.json(await entries.find({}).toArray());
});

await app.listen();
