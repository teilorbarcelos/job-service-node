import nodemailer, { Transporter } from 'nodemailer';
import handlebars from 'handlebars';
import { CONFIG } from '../../shared/config/env.js';

export interface SendEmailParams {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

export interface IEmailProvider {
  sendEmail(params: SendEmailParams): Promise<void>;
}

export class EmailProvider implements IEmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: CONFIG.SMTP.SERVER,
      port: 587,
      secure: false,
      auth: {
        user: CONFIG.SMTP.USER,
        pass: CONFIG.SMTP.PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendEmail({ to, subject, template, context }: SendEmailParams): Promise<void> {
    const compiledTemplate = handlebars.compile(template);
    const html = compiledTemplate(context);

    await this.transporter.sendMail({
      from: `"No Reply" <${CONFIG.SMTP.USER}>`,
      to,
      subject,
      html,
    });
  }
}

export const emailProvider = new EmailProvider();
