export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RecordingStatus = "pending" | "running" | "completed" | "failed";

export interface SchedulePayload {
  streamPageUrl: string;
  directStreamUrl?: string;
  timezone: string;
  weekdays: Weekday[];
  startTime: string;
  endTime: string;
  enabled: boolean;
  leadSeconds: number;
  tailSeconds: number;
}

export interface Schedule extends SchedulePayload {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recording {
  id: string;
  scheduleId: string;
  lectureDate: string;
  status: RecordingStatus;
  startedAt?: string;
  endedAt?: string;
  storagePath?: string;
  durationSec?: number;
  error?: string;
}

export interface TriggerPayload {
  scheduleId: string;
  lectureDate: string;
  recordingId: string;
}
