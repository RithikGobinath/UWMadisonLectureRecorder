import { CollectionReference, Firestore } from "@google-cloud/firestore";
import { v4 as uuidv4 } from "uuid";

import { Recording, RecordingStatus, Schedule, SchedulePayload } from "../types";
import { CreatePendingResult, RecordingRepository, ScheduleRepository } from "./interfaces";
import { recordingIdFor } from "./memoryRepository";

function nowIso(): string {
  return new Date().toISOString();
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { code?: number | string };
  return candidate.code === 6 || candidate.code === "ALREADY_EXISTS";
}

export class FirestoreScheduleRepository implements ScheduleRepository {
  private readonly collection: CollectionReference<Schedule>;

  constructor(private readonly firestore: Firestore) {
    this.collection = firestore.collection("schedules");
  }

  async create(payload: SchedulePayload): Promise<Schedule> {
    const schedule: Schedule = {
      id: uuidv4(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...payload,
    };
    await this.collection.doc(schedule.id).set(schedule);
    return schedule;
  }

  async list(): Promise<Schedule[]> {
    const snapshot = await this.collection.orderBy("updatedAt", "desc").get();
    return snapshot.docs.map((doc) => doc.data() as Schedule);
  }

  async get(id: string): Promise<Schedule | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as Schedule;
  }

  async update(id: string, patch: Partial<SchedulePayload>): Promise<Schedule | null> {
    const current = await this.get(id);
    if (!current) {
      return null;
    }
    const next: Schedule = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    await this.collection.doc(id).set(next);
    return next;
  }

  async disable(id: string): Promise<boolean> {
    const current = await this.get(id);
    if (!current) {
      return false;
    }
    await this.collection.doc(id).set({
      ...current,
      enabled: false,
      updatedAt: nowIso(),
    });
    return true;
  }
}

export class FirestoreRecordingRepository implements RecordingRepository {
  private readonly collection: CollectionReference<Recording>;

  constructor(private readonly firestore: Firestore) {
    this.collection = firestore.collection("recordings");
  }

  async list(scheduleId?: string): Promise<Recording[]> {
    const query = scheduleId
      ? this.collection
          .where("scheduleId", "==", scheduleId)
          .orderBy("lectureDate", "desc")
          .limit(200)
      : this.collection.orderBy("lectureDate", "desc").limit(200);
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as Recording);
  }

  async get(id: string): Promise<Recording | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as Recording;
  }

  async createOrGetPending(scheduleId: string, lectureDate: string): Promise<CreatePendingResult> {
    const id = recordingIdFor(scheduleId, lectureDate);
    const docRef = this.collection.doc(id);
    const pending: Recording = {
      id,
      scheduleId,
      lectureDate,
      status: "pending",
    };
    try {
      await docRef.create(pending);
      return { recording: pending, isNew: true };
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
      const existing = await docRef.get();
      return { recording: existing.data() as Recording, isNew: false };
    }
  }

  async markRunning(id: string, startedAt: string): Promise<void> {
    await this.transition(id, "running", { startedAt, error: undefined });
  }

  async markCompleted(
    id: string,
    endedAt: string,
    storagePath: string,
    durationSec: number
  ): Promise<void> {
    await this.transition(id, "completed", {
      endedAt,
      storagePath,
      durationSec,
      error: undefined,
    });
  }

  async markFailed(id: string, endedAt: string, error: string): Promise<void> {
    await this.transition(id, "failed", { endedAt, error });
  }

  private async transition(
    id: string,
    status: RecordingStatus,
    patch: Partial<Recording>
  ): Promise<void> {
    const docRef = this.collection.doc(id);
    await docRef.set({ status, ...patch }, { merge: true });
  }
}
