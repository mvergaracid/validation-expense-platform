export abstract class BatchPublisher {
  abstract publishBatch(params: {
    topic: string;
    batch: Record<string, unknown>[];
    meta: { processId: string; batchIndex: number };
  }): Promise<void>;
}
