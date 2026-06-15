import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailProvider } from '@/infra/email/EmailProvider.js';

const { mockSendMail, mockTransporter } = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: '123' });
  return {
    mockSendMail: sendMail,
    mockTransporter: { sendMail }
  };
});

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue(mockTransporter)
  },
  createTransport: vi.fn().mockReturnValue(mockTransporter)
}));

describe('EmailProvider', () => {
  let emailProvider: EmailProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    emailProvider = new EmailProvider();
  });

  it('should call sendMail with correct parameters', async () => {
    await emailProvider.sendEmail({
      to: 'test@example.com',
      subject: 'Test Subject',
      template: '<h1>Hello {{name}}</h1>',
      context: { name: 'John' }
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Hello John</h1>'
      })
    );
  });
});
