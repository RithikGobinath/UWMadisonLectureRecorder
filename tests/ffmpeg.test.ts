import { describe, expect, it } from "vitest";

import { buildCaptureArgs, buildTrimArgs } from "../src/services/ffmpegService";

describe("ffmpeg argument builders", () => {
  it("builds capture args with stream-copy and duration", () => {
    const args = buildCaptureArgs("https://example.com/stream.m3u8", "/tmp/raw.ts", 3120);
    expect(args).toEqual([
      "-y",
      "-i",
      "https://example.com/stream.m3u8",
      "-c",
      "copy",
      "-t",
      "3120",
      "/tmp/raw.ts",
    ]);
  });

  it("builds trim args with offset and output duration", () => {
    const args = buildTrimArgs("/tmp/raw.ts", "/tmp/final.mp4", 60, 3000);
    expect(args).toEqual([
      "-y",
      "-ss",
      "60",
      "-i",
      "/tmp/raw.ts",
      "-t",
      "3000",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      "/tmp/final.mp4",
    ]);
  });
});
