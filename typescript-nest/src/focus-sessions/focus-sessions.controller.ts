import { FocusSessionsService, type FocusSession } from "@cero/core";
import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { PauseFocusSessionDto } from "./dto/pause-focus-session.dto.ts";
import { StartFocusSessionDto } from "./dto/start-focus-session.dto.ts";

/** `/focus-sessions`: each handler maps one route to one use case. */
@Controller("focus-sessions")
export class FocusSessionsController {
  constructor(private readonly focusSessions: FocusSessionsService) {}

  @Get()
  list(): Promise<FocusSession[]> {
    return this.focusSessions.list();
  }

  @Get("active")
  async getCurrent(): Promise<FocusSession | Record<string, never>> {
    // The contract answers an empty object, not null, when no session is current.
    return (await this.focusSessions.getCurrent()) ?? {};
  }

  @Post()
  start(@Body() { tasks, startTime }: StartFocusSessionDto): Promise<FocusSession> {
    return this.focusSessions.start({ taskIds: tasks, startTime });
  }

  @Patch("finish")
  finishCurrent(): Promise<FocusSession> {
    return this.focusSessions.finishCurrent();
  }

  @Patch("pause")
  pauseCurrent(@Body() body: PauseFocusSessionDto): Promise<FocusSession> {
    return this.focusSessions.pauseCurrent(body);
  }

  @Patch("resume")
  resumeCurrent(): Promise<FocusSession> {
    return this.focusSessions.resumeCurrent();
  }

  @Patch(":id/finish")
  finish(@Param("id") id: string): Promise<FocusSession> {
    return this.focusSessions.finish(id);
  }

  @Patch(":id/pause")
  pause(@Param("id") id: string): Promise<FocusSession> {
    return this.focusSessions.pause(id);
  }

  @Patch(":id/resume")
  resume(@Param("id") id: string): Promise<FocusSession> {
    return this.focusSessions.resume(id);
  }
}
