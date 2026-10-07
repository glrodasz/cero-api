import { TasksService, type Task } from "@cero/core";
import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CreateTaskDto } from "./dto/create-task.dto.ts";
import { UpdateTaskDto } from "./dto/update-task.dto.ts";

/** `/tasks`: each handler maps one route to one use case. */
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(): Promise<Task[]> {
    return this.tasks.list();
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<Task> {
    return this.tasks.get(id);
  }

  @Post()
  create(@Body() body: CreateTaskDto): Promise<Task> {
    return this.tasks.create(body);
  }

  // Declared before ":id/:status": Express matches routes in declaration order.
  @Patch(":id/complete")
  complete(@Param("id") id: string): Promise<Task> {
    return this.tasks.complete(id);
  }

  @Patch(":id/reset")
  reset(@Param("id") id: string): Promise<Task> {
    return this.tasks.reset(id);
  }

  @Patch(":id/:status")
  changeStatus(@Param("id") id: string, @Param("status") status: string): Promise<Task> {
    return this.tasks.changeStatus(id, status);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() changes: UpdateTaskDto): Promise<Task> {
    return this.tasks.update(id, changes);
  }

  @Delete(":id")
  delete(@Param("id") id: string): Promise<Task> {
    return this.tasks.delete(id);
  }
}
