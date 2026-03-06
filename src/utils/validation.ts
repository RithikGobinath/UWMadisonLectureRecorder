import { DateTime } from "luxon";

import { SchedulePayload, Weekday } from "../types";
import { parseHhMm } from "./time";

export interface ValidationIssue {
  field: string;
  message: string;
}

function uniqueWeekdays(values: number[]): Weekday[] {
  const set = new Set(values);
  return [...set].filter((day): day is Weekday => day >= 0 && day <= 6);
}

export function normalizeSchedulePayload(payload: Partial<SchedulePayload>): SchedulePayload {
  return {
    streamPageUrl: (payload.streamPageUrl ?? "").trim(),
    directStreamUrl: payload.directStreamUrl?.trim() || undefined,
    timezone: payload.timezone?.trim() || "America/Chicago",
    weekdays: uniqueWeekdays(payload.weekdays ?? [1, 2, 3, 4, 5]),
    startTime: payload.startTime ?? "13:10",
    endTime: payload.endTime ?? "14:00",
    enabled: payload.enabled ?? true,
    leadSeconds: payload.leadSeconds ?? 60,
    tailSeconds: payload.tailSeconds ?? 60,
  };
}

export function validateSchedulePayload(payload: SchedulePayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!payload.streamPageUrl || !/^https?:\/\//.test(payload.streamPageUrl)) {
    issues.push({
      field: "streamPageUrl",
      message: "streamPageUrl must be an http/https URL.",
    });
  }

  if (payload.directStreamUrl && !/^https?:\/\//.test(payload.directStreamUrl)) {
    issues.push({
      field: "directStreamUrl",
      message: "directStreamUrl must be an http/https URL.",
    });
  }

  const zoneCheck = DateTime.now().setZone(payload.timezone);
  if (!zoneCheck.isValid) {
    issues.push({ field: "timezone", message: "timezone must be a valid IANA time zone." });
  }

  if (!Array.isArray(payload.weekdays) || payload.weekdays.length === 0) {
    issues.push({ field: "weekdays", message: "weekdays must contain at least one day." });
  } else if (payload.weekdays.some((day) => day < 0 || day > 6)) {
    issues.push({ field: "weekdays", message: "weekdays must be numbers in [0..6]." });
  }

  try {
    parseHhMm(payload.startTime);
  } catch (error) {
    issues.push({
      field: "startTime",
      message: error instanceof Error ? error.message : "Invalid startTime",
    });
  }

  try {
    parseHhMm(payload.endTime);
  } catch (error) {
    issues.push({
      field: "endTime",
      message: error instanceof Error ? error.message : "Invalid endTime",
    });
  }

  if (payload.leadSeconds < 0) {
    issues.push({ field: "leadSeconds", message: "leadSeconds must be >= 0." });
  }
  if (payload.tailSeconds < 0) {
    issues.push({ field: "tailSeconds", message: "tailSeconds must be >= 0." });
  }
  if (payload.leadSeconds % 60 !== 0) {
    issues.push({
      field: "leadSeconds",
      message: "leadSeconds must be divisible by 60 for minute cron scheduling.",
    });
  }

  return issues;
}
