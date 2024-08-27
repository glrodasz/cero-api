import express, { Express, Router, Request, Response } from "express";
const focusSessionRouter: Router = express.Router();

focusSessionRouter.get("/active", (req: Request, res: Response) => {
  res.json([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
});

focusSessionRouter.patch("/finish", (req: Request, res: Response) => {
  res.json({ id: req.params.id });
});

focusSessionRouter.patch("/pause", (req: Request, res: Response) => {
  res.json({ id: req.params.id });
});

focusSessionRouter.patch("/resume", (req: Request, res: Response) => {
  res.json({ id: req.params.id });
});

focusSessionRouter.post("/", (req: Request, res: Response) => {
  res.json([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
});

export default (app: Express) => {
  app.use("/focus-sessions", focusSessionRouter);
};
