import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockChannel = {
    assertQueue: vi.fn().mockResolvedValue(undefined),
    assertExchange: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    prefetch: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn(),
    ack: vi.fn(),
    nack: vi.fn(),
    publish: vi.fn(),
    close: vi.fn(),
  };

  const mockSetups: Array<(channel: typeof mockChannel) => Promise<void>> = [];

  const mockChannelWrapper = {
    waitForConnect: vi.fn().mockImplementation(async () => {
      for (const setup of mockSetups) {
        await setup(mockChannel);
      }
    }),
    sendToQueue: vi.fn().mockResolvedValue(undefined),
    addSetup: vi.fn().mockImplementation(async (setup: (channel: typeof mockChannel) => Promise<void>) => {
      mockSetups.push(setup);
      await setup(mockChannel);
    }),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockConnection = {
    createChannel: vi.fn().mockImplementation((options?: { setup?: typeof mockSetups[0] }) => {
      if (options?.setup) {
        mockSetups.push(options.setup);
      }
      return mockChannelWrapper;
    }),
    isConnected: vi.fn().mockReturnValue(true),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return { mockChannel, mockChannelWrapper, mockConnection, mockSetups };
});

vi.mock('amqp-connection-manager', () => ({
  connect: vi.fn().mockReturnValue(mocks.mockConnection),
}));

import * as acm from 'amqp-connection-manager';
import { RabbitMQProvider } from '@/infra/messaging/RabbitMQProvider.js';
import { CONFIG } from '@/shared/config/env.js';
import { logger } from '@/shared/utils/logger.js';

describe('RabbitMQProvider', () => {
  let provider: RabbitMQProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSetups.length = 0;
    mocks.mockChannel.consume.mockReset();
    mocks.mockChannelWrapper.waitForConnect = vi.fn().mockImplementation(async () => {
      for (const setup of mocks.mockSetups) {
        await setup(mocks.mockChannel);
      }
    });
    provider = new RabbitMQProvider();
  });

  it('should not connect if messaging is disabled', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = false;

    await provider.connect();

    expect(acm.connect).not.toHaveBeenCalled();
  });

  it('should connect if messaging is enabled', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    await provider.connect();

    expect(acm.connect).toHaveBeenCalledWith(
      ['amqp://localhost'],
      expect.objectContaining({ heartbeatIntervalInSeconds: 5, reconnectTimeInSeconds: 2 }),
    );
    expect(mocks.mockConnection.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ confirm: true, json: false }),
    );
    expect(mocks.mockChannel.assertExchange).toHaveBeenCalledWith('dlx', 'direct', { durable: true });
    expect(mocks.mockChannel.assertExchange).toHaveBeenCalledWith('retry-exchange', 'direct', { durable: true });
    expect(mocks.mockChannel.assertQueue).toHaveBeenCalledWith('dlq', { durable: true });
    expect(mocks.mockChannel.bindQueue).toHaveBeenCalledWith('dlq', 'dlx', '');
  });

  it('should publish a message', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    await provider.connect();
    await provider.publish('test-queue', { foo: 'bar' });

    expect(mocks.mockChannelWrapper.assertQueue).toHaveBeenCalledWith('test-queue', {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'dlx' },
    });
    expect(mocks.mockChannelWrapper.sendToQueue).toHaveBeenCalledWith(
      'test-queue',
      expect.any(Buffer),
    );
  });

  it('should subscribe to a queue', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    mocks.mockChannel.consume.mockImplementation((_queue: string, callback: (msg: any) => void) => {
      callback({ content: Buffer.from(JSON.stringify({ hello: 'world' })) });
    });

    await provider.connect();

    const callback = vi.fn();
    await provider.subscribe('test-queue', callback);

    expect(mocks.mockChannel.assertQueue).toHaveBeenCalledWith('test-queue', {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'dlx' },
    });
    expect(mocks.mockChannel.prefetch).toHaveBeenCalledWith(16);
    expect(callback).toHaveBeenCalledWith({ hello: 'world' });
    expect(mocks.mockChannel.ack).toHaveBeenCalled();
  });

  function createMockMsg(payload: Record<string, unknown>, retryCount = 0): Record<string, unknown> {
    return {
      content: Buffer.from(JSON.stringify(payload)),
      properties: { headers: { 'x-retry-count': retryCount } },
    };
  }

  it('should startConsumer with manual ack and nack on error', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    mocks.mockChannel.consume.mockImplementation((_queue: string, callback: (msg: any) => void) => {
      callback(createMockMsg({ data: 'test' }));
    });

    await provider.connect();

    const handler = vi.fn().mockResolvedValue(undefined);
    await provider.startConsumer('work-queue', handler);

    expect(mocks.mockChannel.assertQueue).toHaveBeenCalledWith('work-queue', {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'dlx' },
    });
    expect(mocks.mockChannel.assertQueue).toHaveBeenCalledWith('work-queue.retry', {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: 'work-queue',
    });
    expect(mocks.mockChannel.prefetch).toHaveBeenCalledWith(16);
    expect(handler).toHaveBeenCalledWith({ data: 'test' });
    expect(mocks.mockChannel.ack).toHaveBeenCalled();
  });

  it('should publish to retry-exchange when handler throws (retry count < max)', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    mocks.mockChannel.consume.mockImplementation((_queue: string, callback: (msg: any) => void) => {
      callback(createMockMsg({ data: 'bad' }, 0));
    });

    await provider.connect();

    const handler = vi.fn().mockRejectedValue(new Error('handler error'));
    await provider.startConsumer('work-queue', handler);

    expect(mocks.mockChannel.publish).toHaveBeenCalledWith(
      'retry-exchange',
      'work-queue.retry',
      expect.any(Buffer),
      expect.objectContaining({
        headers: { 'x-retry-count': 1 },
        expiration: '1000',
      }),
    );
    expect(mocks.mockChannel.ack).toHaveBeenCalled();
    expect(mocks.mockChannel.nack).not.toHaveBeenCalled();
  });

  it('should treat missing x-retry-count as 0 and retry', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    mocks.mockChannel.consume.mockImplementation((_queue: string, callback: (msg: any) => void) => {
      callback({ content: Buffer.from(JSON.stringify({ data: 'no-header' })) });
    });

    await provider.connect();

    const handler = vi.fn().mockRejectedValue(new Error('handler error'));
    await provider.startConsumer('work-queue', handler);

    expect(mocks.mockChannel.publish).toHaveBeenCalledWith(
      'retry-exchange',
      'work-queue.retry',
      expect.any(Buffer),
      expect.objectContaining({
        headers: { 'x-retry-count': 1 },
        expiration: '1000',
      }),
    );
    expect(mocks.mockChannel.ack).toHaveBeenCalled();
  });

  it('should nack to DLX when retry count >= max', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    mocks.mockChannel.consume.mockImplementation((_queue: string, callback: (msg: any) => void) => {
      callback(createMockMsg({ data: 'bad' }, 4));
    });

    await provider.connect();

    const handler = vi.fn().mockRejectedValue(new Error('handler error'));
    await provider.startConsumer('work-queue', handler);

    expect(mocks.mockChannel.nack).toHaveBeenCalledWith(expect.any(Object), false, false);
    expect(mocks.mockChannel.publish).not.toHaveBeenCalled();
  });

  it('should ignore null message in startConsumer', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    mocks.mockChannel.consume.mockImplementation((_queue: string, callback: (msg: any) => void) => {
      callback(null);
    });

    await provider.connect();

    const handler = vi.fn();
    await provider.startConsumer('work-queue', handler);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should throw error if connection fails', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    const originalWaitForConnect = mocks.mockChannelWrapper.waitForConnect;
    mocks.mockChannelWrapper.waitForConnect = vi.fn().mockRejectedValue(new Error('Connection failed'));

    const loggerSpy = vi.spyOn(logger, 'error');

    await expect(provider.connect()).rejects.toThrow('Connection failed');
    expect(loggerSpy).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), '[RabbitMQ] Connection failed');

    mocks.mockChannelWrapper.waitForConnect = originalWaitForConnect;
    loggerSpy.mockRestore();
  });

  it('should throw error if publishing and not initialized', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;
    await expect(provider.publish('test', {})).rejects.toThrow('RabbitMQ channel not initialized');
  });

  it('should return silently if publishing and messaging is disabled', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = false;
    await expect(provider.publish('test', {})).resolves.toBeUndefined();
  });

  it('should throw error if subscribing and not initialized', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;
    await expect(provider.subscribe('test', () => {})).rejects.toThrow('RabbitMQ channel not initialized');
  });

  it('should return silently if subscribing and messaging is disabled', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = false;
    await expect(provider.subscribe('test', () => {})).resolves.toBeUndefined();
  });

  it('should check connection status', async () => {
    expect(await provider.check()).toBe(false);

    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;
    await provider.connect();

    expect(await provider.check()).toBe(true);
  });

  it('should disconnect successfully', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    await provider.connect();
    await provider.disconnect();

    expect(mocks.mockChannelWrapper.close).toHaveBeenCalled();
    expect(mocks.mockConnection.close).toHaveBeenCalled();
  });

  it('should handle null message in subscribe', async () => {
    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    mocks.mockChannel.consume.mockImplementation((_queue: string, callback: (msg: any) => void) => {
      callback(null);
    });

    await provider.connect();

    const callback = vi.fn();
    await provider.subscribe('test-queue', callback);

    expect(callback).not.toHaveBeenCalled();
    expect(mocks.mockChannel.ack).not.toHaveBeenCalled();
  });

  it('should startConsumer silently when channel is null', async () => {
    await expect(provider.startConsumer('q', vi.fn())).resolves.toBeUndefined();
  });
});
