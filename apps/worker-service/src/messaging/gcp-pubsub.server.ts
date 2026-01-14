import { PubSub, Subscription } from '@google-cloud/pubsub';
import {
  CustomTransportStrategy,
  Server,
} from '@nestjs/microservices';

export interface GcpPubSubServerOptions {
  projectId?: string;
  subscriptionName?: string;
}

interface PubSubEnvelope {
  pattern?: string;
  data?: unknown;
}

export class GcpPubSubServer extends Server implements CustomTransportStrategy {
  private readonly pubsub: PubSub;
  private subscription?: Subscription;

  constructor(private readonly options: GcpPubSubServerOptions) {
    super();
    this.pubsub = new PubSub({
      projectId: options.projectId,
    });
  }

  async listen(callback: () => void) {
    const subscriptionName = this.options.subscriptionName;
    if (!subscriptionName) {
      throw new Error('GCP_PUBSUB_SUBSCRIPTION es requerido');
    }

    this.subscription = this.pubsub.subscription(subscriptionName);

    this.subscription.on('message', async (message) => {
      try {
        const payload = message.data.toString('utf-8');
        const parsed = JSON.parse(payload) as PubSubEnvelope;
        const pattern = parsed.pattern;
        const data = parsed.data;

        if (!pattern) {
          message.nack();
          return;
        }

        const handler = (this as unknown as { messageHandlers: Map<string, any> })
          .messageHandlers.get(pattern);
        if (!handler) {
          message.ack();
          return;
        }

        const result = handler(data);
        await Promise.resolve(result);
        message.ack();
      } catch {
        message.nack();
      }
    });

    this.subscription.on('error', () => {
      // no-op: error is propagated by pubsub client
    });

    callback();
  }

  async close() {
    if (this.subscription) {
      this.subscription.removeAllListeners();
    }
  }

  on(event: any, callback: any): any {
    // Pub/Sub client handles its own event emitter; required by Nest Server contract.
    // We accept any signature to satisfy Server's generic contract.
    void event;
    void callback;
    return this;
  }

  unwrap<T>(): T {
    return this.pubsub as unknown as T;
  }
}
