import * as amqp from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import { CONFIG } from '../../shared/config/env.js';
import { logger } from '../../shared/utils/logger.js';

export class RabbitMQProvider {
  private connection: amqp.AmqpConnectionManager | null = null;
  private channel: amqp.ChannelWrapper | null = null;

  public async connect(): Promise<void> {
    if (!CONFIG.PROVIDERS.MESSAGING.ENABLED) {
      logger.info('[RabbitMQ] Messaging disabled, skipping connect');
      return;
    }

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
      },
    });

    await this.channel.waitForConnect();
    logger.info('[RabbitMQ] Connected');
  }

  public async publish<T>(queue: string, message: T): Promise<void> {
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

    await this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
  }

  public check(): boolean {
    return this.connection?.isConnected() ?? false;
  }

  public async disconnect(): Promise<void> {
    try {
      await this.channel?.close();
    } catch (err) {
      logger.error({ err }, '[RabbitMQ] Error closing channel');
    }
    try {
      await this.connection?.close();
    } catch (err) {
      logger.error({ err }, '[RabbitMQ] Error closing connection');
    }
    this.channel = null;
    this.connection = null;
    logger.info('[RabbitMQ] Disconnected');
  }
}

export const messagingProvider = new RabbitMQProvider();
