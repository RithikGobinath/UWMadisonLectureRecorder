import { DateTime } from "luxon";

import { Schedule, Weekday } from "../types";

export interface ParsedTime {
  hour: number;
  minute: number;
}

export function parseHhMm(value: string): ParsedTime {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid HH:mm time: ${value}`);
  }
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid HH:mm time: ${value}`);
  }
  return { hour, minute };
}

export function windowSeconds(startTime: string, endTime: string): number {
  const start = parseHhMm(startTime);
  const end = parseHhMm(endTime);
  let startMinutes = start.hour * 60 + start.minute;
  let endMinutes = end.hour * 60 + end.minute;
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  return (endMinutes - startMinutes) * 60;
}

export function captureSeconds(schedule: Schedule): number {
  return (
    windowSeconds(schedule.startTime, schedule.endTime) +
    schedule.leadSeconds +
    schedule.tailSeconds
  );
}

export function toCloudWeekday(weekday: Weekday): number {
  return weekday;
}

function adjustWeekday(weekday: Weekday, deltaDays: number): Weekday {
  const normalized = ((weekday + deltaDays) % 7 + 7) % 7;
  return normalized as Weekday;
}

export function cronForWeekdayStart(schedule: Schedule, weekday: Weekday): string {
  if (schedule.leadSeconds % 60 !== 0) {
    throw new Error("leadSeconds must be divisible by 60 for minute-level scheduling.");
  }

  const leadMinutes = schedule.leadSeconds / 60;
  const start = parseHhMm(schedule.startTime);
  let minuteOfDay = start.hour * 60 + start.minute - leadMinutes;
  let dayDelta = 0;

  while (minuteOfDay < 0) {
    minuteOfDay += 24 * 60;
    dayDelta -= 1;
  }
  while (minuteOfDay >= 24 * 60) {
    minuteOfDay -= 24 * 60;
    dayDelta += 1;
  }

  const targetWeekday = toCloudWeekday(adjustWeekday(weekday, dayDelta));
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${minute} ${hour} * * ${targetWeekday}`;
}

export function todayInTimezone(timezone: string, now = DateTime.utc()): string {
  return now.setZone(timezone).toFormat("yyyy-LL-dd");
}

export function localLectureStart(schedule: Schedule, lectureDate: string): DateTime {
  const { hour, minute } = parseHhMm(schedule.startTime);
  const dt = DateTime.fromISO(lectureDate, { zone: schedule.timezone }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  if (!dt.isValid) {
    throw new Error(`Invalid lecture date/time for ${lectureDate} in ${schedule.timezone}`);
  }
  return dt;
}
