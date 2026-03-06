import { Storage } from "@google-cloud/storage";

import { assertStorageConfig, config } from "../config";

export class StorageService {
  private readonly storage = new Storage({
    projectId: config.cloudProjectId || undefined,
  });

  async uploadRecording(localFilePath: string, destinationPath: string): Promise<void> {
    assertStorageConfig();
    const bucket = this.storage.bucket(config.recordingsBucket);
    await bucket.upload(localFilePath, {
      destination: destinationPath,
      contentType: "video/mp4",
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=0, no-store",
      },
    });
  }

  async getSignedReadUrl(destinationPath: string): Promise<string> {
    assertStorageConfig();
    const bucket = this.storage.bucket(config.recordingsBucket);
    const file = bucket.file(destinationPath);
    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + config.signedUrlTtlMinutes * 60 * 1000,
    });
    return signedUrl;
  }
}
