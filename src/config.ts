import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer.`);
  }
  return parsed;
}

export const config = {
  port: parseIntEnv("PORT", 8080),
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:8080",
  triggerToken: process.env.TRIGGER_TOKEN ?? "dev-trigger-token",
  datastoreMode: process.env.DATASTORE_MODE ?? "memory",
  cloudProjectId:
    process.env.GCP_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "",
  cloudSchedulerLocation: process.env.CLOUD_SCHEDULER_LOCATION ?? "us-central1",
  cloudSchedulerJobPrefix:
    process.env.CLOUD_SCHEDULER_JOB_PREFIX ?? "lecture-recorder",
  cloudSchedulerServiceAccount:
    process.env.CLOUD_SCHEDULER_SERVICE_ACCOUNT ?? "",
  cloudRunRegion: process.env.CLOUD_RUN_REGION ?? "us-central1",
  cloudRunJobName: process.env.CLOUD_RUN_JOB_NAME ?? "lecture-recorder-worker",
  cloudRunJobContainer: process.env.CLOUD_RUN_JOB_CONTAINER ?? "",
  recordingsBucket: process.env.RECORDINGS_BUCKET ?? "",
  signedUrlTtlMinutes: parseIntEnv("SIGNED_URL_TTL_MINUTES", 30),
  dryRunCloudCalls: process.env.DRY_RUN_CLOUD_CALLS
    ? process.env.DRY_RUN_CLOUD_CALLS === "true"
    : true,
};

export function assertCloudConfig(): void {
  if (!config.cloudProjectId) {
    throw new Error("Missing required project id: set GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT.");
  }
  requireEnv("CLOUD_SCHEDULER_LOCATION");
  requireEnv("CLOUD_RUN_REGION");
  requireEnv("CLOUD_RUN_JOB_NAME");
}

export function assertStorageConfig(): void {
  requireEnv("RECORDINGS_BUCKET");
}
