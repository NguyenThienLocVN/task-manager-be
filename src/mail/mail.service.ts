import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST'),
      port: Number(config.get('SMTP_PORT') ?? 587),
      secure: false, // 587 dùng STARTTLS
      auth: { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') },
    });
  }

  async send(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM'),
        to, subject, html,
      });
    } catch (e) {
      this.logger.error(`Send mail failed: ${(e as Error).message}`);
      throw new InternalServerErrorException('Không gửi được email');
    }
  }

  sendTaskReminder(to: string, task: { title: string; dueDate?: string }) {
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!);
    const title = escapeHtml(task.title);
    const dueDate = task.dueDate ? escapeHtml(task.dueDate) : undefined;

    return this.send(
      to,
      `Nhắc việc: ${task.title.replace(/[\r\n]/g, ' ')}`,
      `<p>Bạn có công việc cần xử lý: <b>${title}</b></p>
       ${dueDate ? `<p>Hạn: ${dueDate}</p>` : ''}`,
    );
  }
}