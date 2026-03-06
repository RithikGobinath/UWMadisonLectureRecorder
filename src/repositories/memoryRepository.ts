import { v4 as uuidv4 } from "uuid";

import { Recording, RecordingStatus, Schedule, SchedulePayload } from "../types";
import { CreatePendingResult, RecordingRepository, ScheduleRepository } from "./interfaces";

export function recordingIdFor(scheduleId: string, lectureDate: string): string {
  return `${scheduleId}__${lectureDate}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makePendingRecord(scheduleId: string, lectureDate: string): Recording {
  return {
    id: recordingIdFor(scheduleId, lectureDate),
    scheduleId,
    lectureDate,
    status: "pending",
  };
}

export class MemoryScheduleRepository implements ScheduleRepository {
  private readonly schedules = new Map<string, Schedule>();

  async create(payload: SchedulePayload): Promise<Schedule> {
    const schedule: Schedule = {
      id: uuidv4(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...payload,
    };
    this.schedules.set(schedule.id, schedule);
    return clone(schedule);
  }

  async list(): Promise<Schedule[]> {
    return [...this.schedules.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((schedule) => clone(schedule));
  }

  async get(id: string): Promise<Schedule | null> {
    const schedule = this.schedules.get(id);
    return schedule ? clone(schedule) : null;
  }

  async update(id: string, patch: Partial<SchedulePayload>): Promise<Schedule | null> {
    const current = this.schedules.get(id);
    if (!current) {
      return null;
    }
    const updated: Schedule = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    this.schedules.set(id, updated);
    return clone(updated);
  }

  async disable(id: string): Promise<boolean> {
    const current = this.schedules.get(id);
    if (!current) {
      return false;
    }
    this.schedules.set(id, {
      ...current,
      enabled: false,
      updatedAt: nowIso(),
    });
    return true;
  }
}

export class MemoryRecordingRepository implements RecordingRepository {
  private readonly recordings = new Map<string, Recording>();

  async list(scheduleId?: string): Promise<Recording[]> {
    const values = [...this.recordings.values()];
    return values
      .filter((recording) => (scheduleId ? recording.scheduleId === scheduleId : true))
      .sort((a, b) => b.lectureDate.localeCompare(a.lectureDate))
      .map((recording) => clone(recording));
  }

  async get(id: string): Promise<Recording | null> {
    const record = this.recordings.get(id);
    return record ? clone(record) : null;
  }

  async createOrGetPending(scheduleId: string, lectureDate: string): Promise<CreatePendingResult> {
    const id = recordingIdFor(scheduleId, lectureDate);
    const existing = this.recordings.get(id);
    if (existing) {
      return { recording: clone(existing), isNew: false };
    }
    const pending = makePendingRecord(scheduleId, lectureDate);
    this.recordings.set(id, pending);
    return { recording: clone(pending), isNew: true };
  }

  async markRunning(id: string, startedAt: string): Promise<void> {
    this.transition(id, "running", { startedAt });
  }

  async markCompleted(
    id: string,
    endedAt: string,
    storagePath: string,
    durationSec: number
  ): Promise<void> {
    this.transition(id, "completed", { endedAt, storagePath, durationSec });
  }

  async markFailed(id: string, endedAt: string, error: string): Promise<void> {
    this.transition(id, "failed", { endedAt, error });
  }

  private transition(
    id: string,
    status: RecordingStatus,
    patch: Partial<Recording>
  ): void {
    const current = this.recordings.get(id);
    if (!current) {
      throw new Error(`Recording ${id} not found`);
    }
    this.recordings.set(id, { ...current, status, ...patch });
  }
}
