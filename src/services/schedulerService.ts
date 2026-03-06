import { CloudSchedulerClient } from "@google-cloud/scheduler";

import { assertCloudConfig, config } from "../config";
import { Schedule, Weekday } from "../types";
import { cronForWeekdayStart } from "../utils/time";

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { code?: number | string };
  return candidate.code === 6 || candidate.code === "ALREADY_EXISTS";
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { code?: number | string };
  return candidate.code === 5 || candidate.code === "NOT_FOUND";
}

function weekdayValues(): Weekday[] {
  return [0, 1, 2, 3, 4, 5, 6];
}

export class SchedulerService {
  private readonly client = new CloudSchedulerClient();

  async syncSchedule(schedule: Schedule): Promise<void> {
    if (config.dryRunCloudCalls) {
      return;
    }
    assertCloudConfig();
    const parent = this.client.locationPath(
      config.cloudProjectId,
      config.cloudSchedulerLocation
    );

    for (const weekday of weekdayValues()) {
      const enabledForDay = schedule.enabled && schedule.weekdays.includes(weekday);
      const jobId = `${config.cloudSchedulerJobPrefix}-${schedule.id}-d${weekday}`;
      const jobName = this.client.jobPath(
        config.cloudProjectId,
        config.cloudSchedulerLocation,
        jobId
      );

      if (!enabledForDay) {
        await this.deleteJobIfExists(jobName);
        continue;
      }

      const job = {
        name: jobName,
        description: `Lecture recorder trigger for schedule ${schedule.id} day ${weekday}`,
        schedule: cronForWeekdayStart(schedule, weekday),
        timeZone: schedule.timezone,
        httpTarget: {
          uri: `${normalizeBaseUrl(config.apiBaseUrl)}/internal/triggers/${schedule.id}`,
          httpMethod: "POST" as const,
          headers: {
            "Content-Type": "application/json",
            "X-Trigger-Token": config.triggerToken,
          },
          body: Buffer.from(JSON.stringify({ weekday })),
          oidcToken: config.cloudSchedulerServiceAccount
            ? { serviceAccountEmail: config.cloudSchedulerServiceAccount }
            : undefined,
        },
      };

      try {
        await this.client.createJob({ parent, job });
      } catch (error) {
        if (!isAlreadyExistsError(error)) {
          throw error;
        }
        await this.client.updateJob({ job });
      }
    }
  }

  private async deleteJobIfExists(name: string): Promise<void> {
    try {
      await this.client.deleteJob({ name });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }
}
