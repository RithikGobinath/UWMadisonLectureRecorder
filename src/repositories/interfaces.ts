import { Recording, Schedule, SchedulePayload } from "../types";

export interface ScheduleRepository {
  create(payload: SchedulePayload): Promise<Schedule>;
  list(): Promise<Schedule[]>;
  get(id: string): Promise<Schedule | null>;
  update(id: string, patch: Partial<SchedulePayload>): Promise<Schedule | null>;
  disable(id: string): Promise<boolean>;
}

export interface CreatePendingResult {
  recording: Recording;
  isNew: boolean;
}

export interface RecordingRepository {
  list(scheduleId?: string): Promise<Recording[]>;
  get(id: string): Promise<Recording | null>;
  createOrGetPending(scheduleId: string, lectureDate: string): Promise<CreatePendingResult>;
  markRunning(id: string, startedAt: string): Promise<void>;
  markCompleted(id: string, endedAt: string, storagePath: string, durationSec: number): Promise<void>;
  markFailed(id: string, endedAt: string, error: string): Promise<void>;
}
