import type { Task } from "../tasks/Task";

export type FocusSessionStatus = "finished"

export type Pause = {
  id: string;
  startTime: number;
  endTime: number;
  time: number;
};

export type FocusSession = {
  id: string;
  status: FocusSessionStatus;
  startTime: number;
  tasks: Task["id"][];
  pauses: Pause[];
};
