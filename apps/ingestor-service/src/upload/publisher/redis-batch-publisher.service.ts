import { Injectable } from '@nestjs/common';
import { ClientProxyFactory, RedisOptions, Transport } from '@nestjs/microservices';
import { BatchPublisher } from './batch-publisher.service';

@Injectable()
export class RedisBatchPublisher extends BatchPublisher {
  async publishBatch(params: {
    topic: string;
    batch: Record<string, unknown>[];
    meta: { processId: string; batchIndex: number };
  }): Promise<void> {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const parsed = new URL(redisUrl);
    const host = parsed.hostname || 'localhost';
    const port = parsed.port ? Number(parsed.port) : 6379;
    const password = parsed.password || undefined;

    const client = ClientProxyFactory.create({
      transport: Transport.REDIS,
      options: {
        host,
        port,
        password,
      },
    } as RedisOptions);

    await new Promise<void>((resolve, reject) => {
      client
        .emit(params.topic, {
          processId: params.meta.processId,
          batchIndex: params.meta.batchIndex,
          records: params.batch,
        })
        .subscribe({
          complete: () => {
            client.close();
            resolve();
          },
          error: (err) => {
            client.close();
            reject(err);
          },
        });
    });
  }
}
