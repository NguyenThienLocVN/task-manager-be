import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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

  async sendTaskReminder(to: string, task: {
    id: string;
    title: string;
    description?: string;
    dueDate?: string;
  }) {
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!);
    const formatDueDate = (value?: string) => {
      if (!value) return 'Chưa có hạn xử lý';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid task due date');
      }
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      return `${day}/${month}/${date.getUTCFullYear()}`;
    };
    const frontendUrl = this.config.get('FRONTEND_URL') || 'https://qlcv.aiphuongtankhai.vn';
    const frontendBaseUrl = new URL(frontendUrl);
    if (!['http:', 'https:'].includes(frontendBaseUrl.protocol)) {
      throw new Error('FRONTEND_URL must use HTTP or HTTPS');
    }
    const taskUrl = new URL(`/tasks/${encodeURIComponent(task.id)}`, frontendBaseUrl);
    const template = await readFile(join(__dirname, 'templates', 'task-reminder.html'), 'utf8');
    const values: Record<string, string> = {
      title: task.title,
      description: task.description || 'Không có mô tả',
      dueDate: formatDueDate(task.dueDate),
      taskUrl: taskUrl.toString(),
    };
    const html = template.replace(
      /\{\{(title|description|dueDate|taskUrl)\}\}/g,
      (_, key: string) => escapeHtml(values[key]),
    );

    return this.send(
      to,
      `Nhắc việc: ${task.title.replace(/[\r\n]/g, ' ')}`,
      html,
    );
  }
}