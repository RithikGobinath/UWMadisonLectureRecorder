import { describe, expect, it } from "vitest";

import { MemoryRecordingRepository } from "../src/repositories/memoryRepository";

describe("recording idempotency", () => {
  it("creates recording once per schedule/date key", async () => {
    const repository = new MemoryRecordingRepository();
    const first = await repository.createOrGetPending("scheduleA", "2026-03-05");
    const second = await repository.createOrGetPending("scheduleA", "2026-03-05");
    const third = await repository.createOrGetPending("scheduleA", "2026-03-06");

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    expect(second.recording.id).toBe(first.recording.id);
    expect(third.isNew).toBe(true);
    expect(third.recording.id).not.toBe(first.recording.id);
  });
});
