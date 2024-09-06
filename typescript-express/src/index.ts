import express, { Express } from "express";
import tasksRouter from "./features/tasks/tasks.router";
import focusSessionRouter from "./features/focusSessions/focusSessions.router";

const app: Express = express();

// Global middlewares
app.use(express.json());

// Routes
tasksRouter(app);
focusSessionRouter(app);

const port = process.env.PORT;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
