import { App } from "./app.ts";
import { client } from "./db.ts";

const PORT = 8080;

const app = new App(PORT);

interface Entry {
  description: string;
  status: string;
  priority: number;
}



app.use(() => {
  console.log("This is a middleware");
});

app.get("/helloWorld", (_req, res) => {
  res.send("Hello World");
});

app.get("/tasks", async (_req, res) => {
  const db = client.database("test");
  const tasks = db.collection<Entry>("tasks");

  res.json(await tasks.find({}).toArray());
});

app.post("/tasks", async (req, res) => {
  // TODO: move to app.ts
  const decoder = new TextDecoder('utf-8')
  const body = await Deno.readAll(req.body)
  const bodyJson = JSON.parse(decoder.decode(body))

  const db = client.database("test");
  const tasks = db.collection<Entry>("tasks");
  await tasks.insertOne({ ...bodyJson });

  res.send("Taks has been created");
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

app.get("/focus-sessions", (_req, res) => {
  res.json([{
    "status": "finished",
    "id": 1
  }]);
});

await app.listen();
