import express, { Express } from "express";
import tasksRouter from "./features/tasks/tasks.router";
import focusSessionRouter from "./features/focusSessions/focusSessions.router";

const app: Express = express();
app.use(express.json());
tasksRouter(app);
focusSessionRouter(app);

const port = process.env.PORT;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
