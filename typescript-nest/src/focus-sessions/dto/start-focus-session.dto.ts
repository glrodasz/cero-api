import { IsArray, IsInt, IsString } from "class-validator";
import { IsOmittable } from "../../common/is-omittable.decorator.ts";

/** The body of `POST /focus-sessions`. Both fields have defaults in the core. */
export class StartFocusSessionDto {
  /** Ids of the tasks to work on. */
  @IsOmittable()
  @IsArray()
  @IsString({ each: true })
  tasks?: string[];

  @IsOmittable()
  @IsInt()
  startTime?: number;
}
