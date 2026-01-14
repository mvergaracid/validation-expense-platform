import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { StorageService } from './storage.service';

@Injectable()
export class LocalStorageService extends StorageService {
  async saveTemp(file: Express.Multer.File): Promise<{ storageUri: string; localPath?: string }> {
    const baseDir = process.env.LOCAL_UPLOAD_DIR ?? './tmp/uploads';
    await fs.mkdir(baseDir, { recursive: true });

    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${randomUUID()}_${safeOriginalName}`;
    const fullPath = path.join(baseDir, filename);

    await fs.writeFile(fullPath, file.buffer);

    return {
      storageUri: `file://${fullPath}`,
      localPath: fullPath,
    };
  }
}
