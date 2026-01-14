import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

@Injectable()
export class UploadStorageService {
  async saveCsv(file: Express.Multer.File): Promise<{ storageUri: string; filename: string }> {
    const baseDir = process.env.LOCAL_UPLOAD_DIR ?? '/tmp/uploads';
    await fs.mkdir(baseDir, { recursive: true });

    const safeOriginalName = (file.originalname || 'upload.csv').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${randomUUID()}_${safeOriginalName}`;
    const fullPath = path.join(baseDir, filename);

    await fs.writeFile(fullPath, file.buffer);

    return { storageUri: `file://${fullPath}`, filename: safeOriginalName };
  }
}
