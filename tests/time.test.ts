import { describe, expect, it } from "vitest";

import { Schedule } from "../src/types";
import { captureSeconds, cronForWeekdayStart, windowSeconds } from "../src/utils/time";

function baseSchedule(): Schedule {
  return {
    id: "schedule-1",
    streamPageUrl: "http://example.com/stream.html",
    timezone: "America/Chicago",
    weekdays: [1, 3, 5],
    startTime: "13:10",
    endTime: "14:00",
    enabled: true,
    leadSeconds: 60,
    tailSeconds: 60,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("time utils", () => {
  it("computes lecture window and capture duration", () => {
    const schedule = baseSchedule();
    expect(windowSeconds(schedule.startTime, schedule.endTime)).toBe(3000);
    expect(captureSeconds(schedule)).toBe(3120);
  });

  it("builds weekday cron with lead minute", () => {
    const schedule = baseSchedule();
    const cron = cronForWeekdayStart(schedule, 1);
    expect(cron).toBe("9 13 * * 1");
  });

  it("rolls back weekday when lead moves into prior day", () => {
    const schedule = baseSchedule();
    schedule.startTime = "00:01";
    schedule.leadSeconds = 120;
    const cron = cronForWeekdayStart(schedule, 1);
    expect(cron).toBe("59 23 * * 0");
  });
});
