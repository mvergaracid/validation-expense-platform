import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { parse } from 'csv-parse';

@Injectable()
export class CsvSplitterService {
  async streamBatches(params: {
    localPath?: string;
    fileBuffer?: Buffer;
    batchSize: number;
    onBatch: (records: Record<string, string>[]) => Promise<void>;
    onProgress?: (deltaRecords: number, deltaBatches: number) => Promise<void>;
  }): Promise<{ totalRecords: number; totalBatches: number }> {
    if (!params.localPath && !params.fileBuffer) {
      throw new Error('Debe especificar localPath o fileBuffer');
    }

    const input: Readable = params.localPath
      ? createReadStream(params.localPath)
      : Readable.from(params.fileBuffer as Buffer);

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const stream = input.pipe(parser);

    let batch: Record<string, string>[] = [];
    let totalRecords = 0;
    let totalBatches = 0;

    for await (const record of stream) {
      batch.push(record as Record<string, string>);
      totalRecords += 1;

      if (batch.length >= params.batchSize) {
        totalBatches += 1;
        await params.onBatch(batch);
        if (params.onProgress) {
          await params.onProgress(batch.length, 1);
        }
        batch = [];
      }
    }

    if (batch.length > 0) {
      totalBatches += 1;
      await params.onBatch(batch);
      if (params.onProgress) {
        await params.onProgress(batch.length, 1);
      }
    }

    return { totalRecords, totalBatches };
  }
}
