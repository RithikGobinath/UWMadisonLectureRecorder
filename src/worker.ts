import { runRecording } from "./services/recorderService";
import { TriggerPayload } from "./types";

function parseArg(flag: string): string | undefined {
  const arg = process.argv.find((entry) => entry.startsWith(`${flag}=`));
  if (!arg) {
    return undefined;
  }
  return arg.slice(flag.length + 1);
}

function requiredArg(flag: string): string {
  const value = parseArg(flag);
  if (!value) {
    throw new Error(`Missing required argument: ${flag}=...`);
  }
  return value;
}

async function main(): Promise<void> {
  const payload: TriggerPayload = {
    scheduleId: requiredArg("--schedule-id"),
    lectureDate: requiredArg("--lecture-date"),
    recordingId: requiredArg("--recording-id"),
  };
  await runRecording(payload);
  // eslint-disable-next-line no-console
  console.log(`Recording job completed for ${payload.recordingId}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
