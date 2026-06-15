import * as amqp from 'amqp-connection-manager';
import type { Channel, Message } from 'amqplib';
import { CONFIG } from '../../shared/config/env.js';
import { logger } from '../../shared/utils/logger.js';
import { withRetry, createCircuitBreaker } from '../../shared/utils/resilience.js';
import { businessMetrics } from '../../shared/utils/metrics.js';

const RETRY_DELAY_MS = [1000, 5000, 30000, 300000];

export class RabbitMQProvider {
  private connection: amqp.AmqpConnectionManager | null = null;
  private channel: amqp.ChannelWrapper | null = null;
  private publishBreaker!: { fire: (...args: unknown[]) => Promise<void> };

  constructor() {
    this.publishBreaker = createCircuitBreaker(
      this.publishWithRetry.bind(this) as (...args: unknown[]) => Promise<void>,
      { name: 'rabbitmq-publish', timeout: CONFIG.PROVIDERS.MESSAGING.PUBLISH_TIMEOUT },
    );
  }

  private async publishWithRetry(queue: string, messageStr: string): Promise<void> {
    return withRetry(async () => {
      await this.channel!.sendToQueue(queue, Buffer.from(messageStr));
    });
  }

  async connect(): Promise<void> {
    if (!CONFIG.PROVIDERS.MESSAGING.ENABLED) {
      return;
    }

    try {
      this.connection = amqp.connect([CONFIG.PROVIDERS.MESSAGING.RABBIT_URL], {
        heartbeatIntervalInSeconds: 5,
        reconnectTimeInSeconds: 2,
      });

      this.channel = this.connection.createChannel({
        confirm: true,
        json: false,
        publishTimeout: CONFIG.PROVIDERS.MESSAGING.PUBLISH_TIMEOUT,
        setup: async (channel: Channel) => {
          await channel.assertExchange('dlx', 'direct', { durable: true });
          await channel.assertQueue('dlq', { durable: true });
          await channel.bindQueue('dlq', 'dlx', '');
          await channel.assertExchange('retry-exchange', 'direct', { durable: true });
        },
      });

      await this.channel.waitForConnect();
      logger.info('[RabbitMQ] Connected successfully');
    } catch (error) {
      logger.error({ err: error }, '[RabbitMQ] Connection failed');
      throw error;
    }
  }

  async publish<T>(queue: string, message: T): Promise<void> {
    if (!this.channel) {
      if (CONFIG.PROVIDERS.MESSAGING.ENABLED) {
        throw new Error('RabbitMQ channel not initialized');
      }
      return;
    }

    await this.channel.assertQueue(queue, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'dlx' },
    });

    businessMetrics.messagesPublished.labels(queue).inc();
    await this.publishBreaker.fire(queue, JSON.stringify(message));
  }

  async subscribe<T>(queue: string, callback: (message: T) => void): Promise<void> {
    if (!this.channel) {
      if (CONFIG.PROVIDERS.MESSAGING.ENABLED) {
        throw new Error('RabbitMQ channel not initialized');
      }
      return;
    }

    await this.channel.addSetup(async (channel: Channel) => {
      await channel.assertQueue(queue, {
        durable: true,
        arguments: { 'x-dead-letter-exchange': 'dlx' },
      });
      await channel.prefetch(16);
      await channel.consume(queue, (msg) => {
        if (msg) {
          const content = JSON.parse(msg.content.toString()) as T;
          callback(content);
          channel.ack(msg);
        }
      });
    });
  }

  async startConsumer<T>(
    queue: string,
    handler: (message: T) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) return;

    await this.channel.addSetup(async (channel: Channel) => {
      await channel.assertQueue(queue, {
        durable: true,
        arguments: { 'x-dead-letter-exchange': 'dlx' },
      });

      const retryQueue = `${queue}.retry`;
      await channel.assertQueue(retryQueue, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: queue,
      });
      await channel.bindQueue(retryQueue, 'retry-exchange', retryQueue);

      await channel.prefetch(16);
      await channel.consume(queue, async (msg: Message | null) => {
        if (!msg) return;
        try {
          businessMetrics.messagesConsumed.labels(queue).inc();
          const content = JSON.parse(msg.content.toString()) as T;
          await handler(content);
          channel.ack(msg);
        } catch {
          const retryCount: number = (msg.properties?.headers?.['x-retry-count'] as number) ?? 0;

          if (retryCount >= RETRY_DELAY_MS.length) {
            channel.nack(msg, false, false);
          } else {
            const delay = RETRY_DELAY_MS[retryCount];
            channel.publish('retry-exchange', retryQueue, msg.content, {
              headers: { ...(msg.properties?.headers as Record<string, unknown> | undefined), 'x-retry-count': retryCount + 1 },
              expiration: String(delay),
            });
            channel.ack(msg);
          }
        }
      });
    });
  }

  async check(): Promise<boolean> {
    return this.connection?.isConnected() ?? false;
  }

  async disconnect(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}

export const messagingProvider = new RabbitMQProvider();
