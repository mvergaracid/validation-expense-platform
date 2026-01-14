import { Injectable } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';
import { BatchPublisher } from './batch-publisher.service';

@Injectable()
export class GcpPubSubBatchPublisher extends BatchPublisher {
  private readonly pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });

  async publishBatch(params: {
    topic: string;
    batch: Record<string, unknown>[];
    meta: { processId: string; batchIndex: number };
  }): Promise<void> {
    const topicName = process.env.GCP_PUBSUB_TOPIC;
    if (!topicName) {
      throw new Error('GCP_PUBSUB_TOPIC es requerido cuando WORKER_TRANSPORT=gcp_pubsub');
    }

    const payload = {
      pattern: params.topic,
      data: {
        processId: params.meta.processId,
        batchIndex: params.meta.batchIndex,
        records: params.batch,
      },
    };

    await this.pubsub.topic(topicName).publishMessage({
      data: Buffer.from(JSON.stringify(payload), 'utf-8'),
    });
  }
}
