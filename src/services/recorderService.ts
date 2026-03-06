import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { getRepositories } from "../repositories";
import { TriggerPayload } from "../types";
import { captureSeconds, windowSeconds } from "../utils/time";
import { buildCaptureArgs, buildTrimArgs, runFfmpeg } from "./ffmpegService";
import { StorageService } from "./storageService";
import { resolveMediaUrl } from "./streamResolver";

export async function runRecording(payload: TriggerPayload): Promise<void> {
  const repositories = getRepositories();
  const storage = new StorageService();

  const schedule = await repositories.schedules.get(payload.scheduleId);
  if (!schedule) {
    throw new Error(`Schedule ${payload.scheduleId} not found.`);
  }

  const existing = await repositories.recordings.get(payload.recordingId);
  if (existing && existing.status === "completed") {
    return;
  }

  const startedAt = new Date().toISOString();
  await repositories.recordings.markRunning(payload.recordingId, startedAt);

  const captureSec = captureSeconds(schedule);
  const trimDurationSec = windowSeconds(schedule.startTime, schedule.endTime);
  const trimOffsetSec = schedule.leadSeconds;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lecture-recorder-"));
  const rawPath = path.join(tmpDir, "raw.ts");
  const finalPath = path.join(tmpDir, "final.mp4");
  const timestampSlug = new Date().toISOString().replace(/[:.]/g, "-");
  const destinationPath = `recordings/${schedule.id}/${payload.lectureDate}/${timestampSlug}.mp4`;

  try {
    const mediaUrl = await resolveMediaUrl(schedule);
    await runFfmpeg(
      buildCaptureArgs(mediaUrl, rawPath, captureSec),
      "capture"
    );
    await runFfmpeg(
      buildTrimArgs(rawPath, finalPath, trimOffsetSec, trimDurationSec),
      "trim"
    );

    await storage.uploadRecording(finalPath, destinationPath);

    await repositories.recordings.markCompleted(
      payload.recordingId,
      new Date().toISOString(),
      destinationPath,
      trimDurationSec
    );
  } catch (error) {
    await repositories.recordings.markFailed(
      payload.recordingId,
      new Date().toISOString(),
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
