import { IsString } from "class-validator";

/** The body of `POST /tasks`. */
export class CreateTaskDto {
  @IsString()
  description!: string;
}
