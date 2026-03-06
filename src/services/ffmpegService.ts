import { spawn } from "node:child_process";

export function buildCaptureArgs(
  inputUrl: string,
  rawOutputPath: string,
  captureDurationSeconds: number
): string[] {
  return [
    "-y",
    "-i",
    inputUrl,
    "-c",
    "copy",
    "-t",
    String(captureDurationSeconds),
    rawOutputPath,
  ];
}

export function buildTrimArgs(
  rawInputPath: string,
  finalOutputPath: string,
  trimOffsetSeconds: number,
  trimDurationSeconds: number
): string[] {
  return [
    "-y",
    "-ss",
    String(trimOffsetSeconds),
    "-i",
    rawInputPath,
    "-t",
    String(trimDurationSeconds),
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    finalOutputPath,
  ];
}

export async function runFfmpeg(args: string[], label: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const process = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    process.on("error", (error) => {
      reject(error);
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg ${label} failed with code ${code}: ${stderr}`));
    });
  });
}
