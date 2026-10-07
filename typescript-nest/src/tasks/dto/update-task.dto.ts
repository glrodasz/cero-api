import { TASK_STATUSES, type TaskStatus } from "@cero/core";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";
import { IsOmittable } from "../../common/is-omittable.decorator.ts";

/** The body of `PATCH /tasks/:id`: only the fields that are present change. */
export class UpdateTaskDto {
  @IsOmittable()
  @IsString()
  description?: string;

  @IsOmittable()
  @IsInt()
  priority?: number;

  @IsOmittable()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  /** `null` detaches the task from its session. */
  @IsOptional()
  @IsString()
  focusSessionId?: string | null;
}
