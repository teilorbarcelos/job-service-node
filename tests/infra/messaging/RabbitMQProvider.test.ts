import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RabbitMQProvider } from '@/infra/messaging/RabbitMQProvider.js';

const { mockChannel, mockConnection, mockAmqpConnect, envConfig } = vi.hoisted(() => {
  const mockChannel = {
    waitForConnect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    assertExchange: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    sendToQueue: vi.fn().mockResolvedValue(undefined),
  };
  const mockConnection = {
    createChannel: vi.fn().mockImplementation((options: { setup: (channel: unknown) => Promise<void> }) => {
      void options.setup(mockChannel);
      return mockChannel;
    }),
    close: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
  };
  const mockAmqpConnect = vi.fn().mockReturnValue(mockConnection);
  const envConfig = { PROVIDERS: { MESSAGING: { ENABLED: false } } };
  return { mockChannel, mockConnection, mockAmqpConnect, envConfig };
});

vi.mock('amqp-connection-manager', () => ({
  connect: mockAmqpConnect,
}));

vi.mock('@/shared/config/env.js', () => ({
  CONFIG: envConfig,
}));

describe('RabbitMQProvider', () => {
  let provider: RabbitMQProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    envConfig.PROVIDERS.MESSAGING.ENABLED = false;
    provider = new RabbitMQProvider();
  });

  afterEach(() => {
    envConfig.PROVIDERS.MESSAGING.ENABLED = false;
  });

  it('connect deve ser no-op quando MESSAGING_ENABLED=false', async () => {
    await provider.connect();
    expect(mockAmqpConnect).not.toHaveBeenCalled();
  });

  it('check deve retornar false antes de conectar', () => {
    expect(provider.check()).toBe(false);
  });

  it('publish deve ser no-op quando MESSAGING_ENABLED=false', async () => {
    await expect(provider.publish('q', { x: 1 })).resolves.not.toThrow();
  });

  it('publish deve lançar quando channel não inicializado e MESSAGING_ENABLED=true', async () => {
    envConfig.PROVIDERS.MESSAGING.ENABLED = true;
    const live = new RabbitMQProvider();
    try {
      await expect(live.publish('q', { x: 1 })).rejects.toThrow('RabbitMQ channel not initialized');
    } finally {
      envConfig.PROVIDERS.MESSAGING.ENABLED = false;
    }
  });

  it('disconnect deve ser tolerante a estado não inicializado', async () => {
    await expect(provider.disconnect()).resolves.not.toThrow();
  });

  it('disconnect deve fechar channel e connection quando inicializados', async () => {
    envConfig.PROVIDERS.MESSAGING.ENABLED = true;
    const live = new RabbitMQProvider();
    try {
      await live.connect();
      await live.disconnect();
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    } finally {
      envConfig.PROVIDERS.MESSAGING.ENABLED = false;
    }
  });

  it('disconnect deve tolerar erro ao fechar channel', async () => {
    envConfig.PROVIDERS.MESSAGING.ENABLED = true;
    mockChannel.close.mockRejectedValueOnce(new Error('channel fail'));
    const live = new RabbitMQProvider();
    try {
      await live.connect();
      await expect(live.disconnect()).resolves.not.toThrow();
    } finally {
      envConfig.PROVIDERS.MESSAGING.ENABLED = false;
    }
  });

  it('disconnect deve tolerar erro ao fechar connection', async () => {
    envConfig.PROVIDERS.MESSAGING.ENABLED = true;
    mockConnection.close.mockRejectedValueOnce(new Error('conn fail'));
    const live = new RabbitMQProvider();
    try {
      await live.connect();
      await expect(live.disconnect()).resolves.not.toThrow();
    } finally {
      envConfig.PROVIDERS.MESSAGING.ENABLED = false;
    }
  });

  it('publish com MESSAGING_ENABLED=true e channel pronto deve enviar', async () => {
    envConfig.PROVIDERS.MESSAGING.ENABLED = true;
    const live = new RabbitMQProvider();
    try {
      await live.connect();
      await live.publish('queue-x', { hello: 'world' });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        'queue-x',
        expect.objectContaining({ durable: true })
      );
      expect(mockChannel.sendToQueue).toHaveBeenCalledWith('queue-x', expect.any(Buffer));
    } finally {
      envConfig.PROVIDERS.MESSAGING.ENABLED = false;
    }
  });

  it('check deve retornar true quando connection está conectada', async () => {
    envConfig.PROVIDERS.MESSAGING.ENABLED = true;
    const live = new RabbitMQProvider();
    try {
      await live.connect();
      expect(live.check()).toBe(true);
    } finally {
      envConfig.PROVIDERS.MESSAGING.ENABLED = false;
    }
  });
});
