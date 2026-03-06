import express, { NextFunction, Request, Response } from "express";
import path from "node:path";

import { config } from "./config";
import { getRepositories } from "./repositories";
import { RunJobService } from "./services/runJobService";
import { SchedulerService } from "./services/schedulerService";
import { StorageService } from "./services/storageService";
import { SchedulePayload, TriggerPayload } from "./types";
import { todayInTimezone } from "./utils/time";
import {
  normalizeSchedulePayload,
  validateSchedulePayload,
} from "./utils/validation";

function asyncRoute(
  handler: (request: Request, response: Response) => Promise<void>
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response).catch(next);
  };
}

export function createApp(): express.Express {
  const app = express();
  const repositories = getRepositories();
  const scheduler = new SchedulerService();
  const runJob = new RunJobService();
  const storage = new StorageService();

  app.use(express.json({ limit: "1mb" }));

  const publicDir = path.resolve(process.cwd(), "public");
  app.use(express.static(publicDir));

  app.get("/health", (_request, response) => {
    response.json({ ok: true, datastoreMode: config.datastoreMode });
  });

  app.get(
    "/api/schedules",
    asyncRoute(async (_request, response) => {
      const schedules = await repositories.schedules.list();
      response.json({ schedules });
    })
  );

  app.post(
    "/api/schedules",
    asyncRoute(async (request, response) => {
      const payload = normalizeSchedulePayload(
        request.body as Partial<SchedulePayload>
      );
      const issues = validateSchedulePayload(payload);
      if (issues.length > 0) {
        response.status(400).json({ issues });
        return;
      }

      const schedule = await repositories.schedules.create(payload);
      await scheduler.syncSchedule(schedule);
      response.status(201).json({ schedule });
    })
  );

  app.patch(
    "/api/schedules/:id",
    asyncRoute(async (request, response) => {
      const existing = await repositories.schedules.get(request.params.id);
      if (!existing) {
        response.status(404).json({ error: "Schedule not found." });
        return;
      }

      const merged = normalizeSchedulePayload({
        ...existing,
        ...(request.body as Partial<SchedulePayload>),
      } as Partial<SchedulePayload>);
      const issues = validateSchedulePayload(merged);
      if (issues.length > 0) {
        response.status(400).json({ issues });
        return;
      }

      const updated = await repositories.schedules.update(existing.id, merged);
      if (!updated) {
        response.status(404).json({ error: "Schedule not found." });
        return;
      }
      await scheduler.syncSchedule(updated);
      response.json({ schedule: updated });
    })
  );

  app.delete(
    "/api/schedules/:id",
    asyncRoute(async (request, response) => {
      const disabled = await repositories.schedules.disable(request.params.id);
      if (!disabled) {
        response.status(404).json({ error: "Schedule not found." });
        return;
      }
      const schedule = await repositories.schedules.get(request.params.id);
      if (schedule) {
        await scheduler.syncSchedule(schedule);
      }
      response.status(204).send();
    })
  );

  app.post(
    "/api/schedules/:id/run-now",
    asyncRoute(async (request, response) => {
      const schedule = await repositories.schedules.get(request.params.id);
      if (!schedule) {
        response.status(404).json({ error: "Schedule not found." });
        return;
      }
      if (!schedule.enabled) {
        response.status(409).json({ error: "Schedule is disabled." });
        return;
      }
      const lectureDate = todayInTimezone(schedule.timezone);
      const { recording, isNew } = await repositories.recordings.createOrGetPending(
        schedule.id,
        lectureDate
      );
      if (!isNew) {
        response.status(200).json({
          message: "Recording already scheduled for this lecture date.",
          recording,
        });
        return;
      }

      const triggerPayload: TriggerPayload = {
        scheduleId: schedule.id,
        lectureDate,
        recordingId: recording.id,
      };
      await runJob.runRecorderJob(triggerPayload);
      response.status(202).json({ message: "Job started.", payload: triggerPayload });
    })
  );

  app.get(
    "/api/recordings",
    asyncRoute(async (request, response) => {
      const scheduleId =
        typeof request.query.scheduleId === "string"
          ? request.query.scheduleId
          : undefined;
      const recordings = await repositories.recordings.list(scheduleId);

      const enriched = await Promise.all(
        recordings.map(async (recording) => {
          if (recording.status !== "completed" || !recording.storagePath) {
            return { ...recording, signedUrl: null };
          }
          try {
            const signedUrl = await storage.getSignedReadUrl(recording.storagePath);
            return { ...recording, signedUrl };
          } catch {
            return { ...recording, signedUrl: null };
          }
        })
      );

      response.json({ recordings: enriched });
    })
  );

  app.post(
    "/internal/triggers/:scheduleId",
    asyncRoute(async (request, response) => {
      const token = request.header("X-Trigger-Token");
      if (token !== config.triggerToken) {
        response.status(401).json({ error: "Unauthorized trigger token." });
        return;
      }

      const schedule = await repositories.schedules.get(request.params.scheduleId);
      if (!schedule || !schedule.enabled) {
        response.status(404).json({ error: "Schedule not found or disabled." });
        return;
      }

      const providedDate =
        typeof request.body?.lectureDate === "string"
          ? request.body.lectureDate
          : null;
      const lectureDate = providedDate ?? todayInTimezone(schedule.timezone);
      const { recording, isNew } = await repositories.recordings.createOrGetPending(
        schedule.id,
        lectureDate
      );

      if (!isNew) {
        response.status(200).json({
          message: "Duplicate trigger ignored.",
          recordingId: recording.id,
        });
        return;
      }

      const triggerPayload: TriggerPayload = {
        scheduleId: schedule.id,
        lectureDate,
        recordingId: recording.id,
      };

      await runJob.runRecorderJob(triggerPayload);
      response.status(202).json({
        message: "Recorder job started.",
        payload: triggerPayload,
      });
    })
  );

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    response.status(500).json({
      error: "Internal server error.",
      detail: error instanceof Error ? error.message : String(error),
    });
  });

  return app;
}
