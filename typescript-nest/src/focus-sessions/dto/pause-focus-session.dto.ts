import { IsInt } from "class-validator";
import { IsOmittable } from "../../common/is-omittable.decorator.ts";

/** The body of `PATCH /focus-sessions/pause`. */
export class PauseFocusSessionDto {
  @IsOmittable()
  @IsInt()
  time?: number;
}
