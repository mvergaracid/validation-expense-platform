import {
  MicroserviceOptions,
  RedisOptions,
  Transport,
} from '@nestjs/microservices';
import { GcpPubSubServer } from './gcp-pubsub.server.js';

type WorkerTransport = 'redis' | 'gcp_pubsub';

const getWorkerTransport = (): WorkerTransport => {
  const raw = (process.env.WORKER_TRANSPORT ?? 'redis').toLowerCase();
  if (raw === 'redis' || raw === 'gcp_pubsub') {
    return raw;
  }
  throw new Error(
    `WORKER_TRANSPORT inválido: ${process.env.WORKER_TRANSPORT}. Valores soportados: redis | gcp_pubsub`,
  );
};

export const createWorkerMicroserviceOptions = (): MicroserviceOptions => {
  const transport = getWorkerTransport();

  if (transport === 'redis') {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const parsed = new URL(redisUrl);
    const host = parsed.hostname;
    const port = parsed.port ? Number(parsed.port) : 6379;
    const options: RedisOptions = {
      transport: Transport.REDIS,
      options: {
        host,
        port,
      },
    };
    return options;
  }

  const server = new GcpPubSubServer({
    projectId: process.env.GCP_PROJECT_ID,
    subscriptionName: process.env.GCP_PUBSUB_SUBSCRIPTION,
  });

  return { strategy: server };
};
