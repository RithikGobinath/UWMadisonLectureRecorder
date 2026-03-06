import { Firestore } from "@google-cloud/firestore";

import { config } from "../config";
import {
  FirestoreRecordingRepository,
  FirestoreScheduleRepository,
} from "./firestoreRepository";
import {
  MemoryRecordingRepository,
  MemoryScheduleRepository,
} from "./memoryRepository";
import { RecordingRepository, ScheduleRepository } from "./interfaces";

export interface RepositoryBundle {
  schedules: ScheduleRepository;
  recordings: RecordingRepository;
}

let cache: RepositoryBundle | null = null;

export function getRepositories(): RepositoryBundle {
  if (cache) {
    return cache;
  }

  if (config.datastoreMode === "firestore") {
    const firestore = new Firestore({
      projectId: config.cloudProjectId || undefined,
    });
    cache = {
      schedules: new FirestoreScheduleRepository(firestore),
      recordings: new FirestoreRecordingRepository(firestore),
    };
    return cache;
  }

  cache = {
    schedules: new MemoryScheduleRepository(),
    recordings: new MemoryRecordingRepository(),
  };
  return cache;
}
