import { JobsClient } from "@google-cloud/run";

import { assertCloudConfig, config } from "../config";
import { TriggerPayload } from "../types";

export class RunJobService {
  private readonly client = new JobsClient();

  async runRecorderJob(payload: TriggerPayload): Promise<void> {
    if (config.dryRunCloudCalls) {
      return;
    }
    assertCloudConfig();

    const name = this.client.jobPath(
      config.cloudProjectId,
      config.cloudRunRegion,
      config.cloudRunJobName
    );

    const args = [
      `--schedule-id=${payload.scheduleId}`,
      `--lecture-date=${payload.lectureDate}`,
      `--recording-id=${payload.recordingId}`,
    ];

    const request = {
      name,
      overrides: {
        containerOverrides: [
          {
            ...(config.cloudRunJobContainer ? { name: config.cloudRunJobContainer } : {}),
            args,
          },
        ],
      },
    };

    const [operation] = await this.client.runJob(request);
    await operation.promise();
  }
}
