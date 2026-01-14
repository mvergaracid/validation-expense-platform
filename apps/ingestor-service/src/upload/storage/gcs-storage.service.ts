import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import { StorageService } from './storage.service';

@Injectable()
export class GcsStorageService extends StorageService {
  private readonly storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });

  async saveTemp(file: Express.Multer.File): Promise<{ storageUri: string; localPath?: string }> {
    const bucketName = process.env.GCS_BUCKET;
    if (!bucketName) {
      throw new Error('GCS_BUCKET es requerido cuando FILE_STORAGE_BACKEND=gcs');
    }

    const bucket = this.storage.bucket(bucketName);
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectName = `${process.env.GCS_PREFIX ?? 'uploads'}/${randomUUID()}_${safeOriginalName}`;

    const gcsFile = bucket.file(objectName);
    await gcsFile.save(file.buffer, {
      resumable: false,
      contentType: file.mimetype || 'text/csv',
    });

    return {
      storageUri: `gs://${bucketName}/${objectName}`,
    };
  }
}
