import express, { Express, Router, Request, Response } from "express";
const tasksRouter: Router = express.Router();

tasksRouter.get("/", (req: Request, res: Response) => {
  res.json([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
});

tasksRouter.get("/:id", (req: Request, res: Response) => {
  res.json({ id: req.params.id });
});

tasksRouter.post("/", (req: Request, res: Response) => {
  res.json({ id: req.params.id });
});

type TaskStatus = "complete" | "reset";
tasksRouter.patch("/:id/:status", (req: Request, res: Response) => {
  const { id, status }: { id: string; status: TaskStatus } = req.params;
  res.json({ id, status });
});

tasksRouter.patch("/:id/", (req: Request, res: Response) => {
  const { id }: { id: string } = req.params;
  res.json({ id });
});

tasksRouter.delete("/:id", (req: Request, res: Response) => {
  res.json({ id: req.params.id });
});

export default (app: Express) => {
  app.use("/tasks", tasksRouter);
};
