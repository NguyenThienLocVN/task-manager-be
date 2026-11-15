import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService task reminders', () => {
  it('renders the HTML template with escaped task data and a sanitized subject', async () => {
    const service = new MailService({
      get: (key: string) => key === 'FRONTEND_URL' ? 'https://tasks.example.com/' : undefined,
    } as ConfigService);
    const send = vi.spyOn(service, 'send').mockResolvedValue(undefined);

    await service.sendTaskReminder('user@example.com', {
      id: 'task-id',
      title: 'Việc <quan trọng>\r\nBcc: other',
      description: '<script>alert("x")</script> & text',
      dueDate: '2026-11-08T00:00:00.000Z',
    });

    expect(send).toHaveBeenCalledOnce();
    const [recipient, subject, html] = send.mock.calls[0];
    expect(recipient).toBe('user@example.com');
    expect(subject).toBe('Nhắc việc: Việc <quan trọng>  Bcc: other');
    expect(html).toContain('Việc &lt;quan trọng&gt;');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; text');
    expect(html).toContain('href="https://tasks.example.com/tasks/task-id"');
    expect(html).toContain('>Xem công việc</a>');
    expect(html).toContain('08/11/2026');
    expect(html).toContain('<header ');
    expect(html).toContain('HỆ THỐNG QUẢN LÝ CÔNG VIỆC <br> PHƯỜNG TÂN KHAI - TP. ĐỒNG NAI');
    expect(html).toContain('https://qlcv.aiphuongtankhai.vn/_next/image?url=%2Flogo_dong_nai.png&amp;w=256&amp;q=75');
    expect(html).toContain('<footer ');
    expect(html).toContain('Hệ thống thuộc quản lý của <strong>ỦY BAN NHÂN DÂN PHƯỜNG TÂN KHAI</strong>');
    expect(html).toContain('© 2026 | All rights reserved.');
    expect(html).toContain('#0e3060');
    expect(html).not.toContain('{{');
  });

  it('renders defaults when description and due date are missing', async () => {
    const service = new MailService(new ConfigService());
    const send = vi.spyOn(service, 'send').mockResolvedValue(undefined);

    await service.sendTaskReminder('user@example.com', {
      id: 'a8ccd46c-804a-4776-a662-f063a5853998',
      title: 'Việc',
    });

    const html = send.mock.calls[0][2];
    expect(html).toContain('Không có mô tả');
    expect(html).toContain('Chưa có hạn xử lý');
    expect(html).toContain('href="https://qlcv.aiphuongtankhai.vn/tasks/a8ccd46c-804a-4776-a662-f063a5853998"');
  });

  it('formats date-only due dates as dd/mm/yyyy', async () => {
    const service = new MailService(new ConfigService());
    const send = vi.spyOn(service, 'send').mockResolvedValue(undefined);

    await service.sendTaskReminder('user@example.com', {
      id: 'task-id',
      title: 'Việc',
      dueDate: '2026-02-03',
    });

    expect(send.mock.calls[0][2]).toContain('03/02/2026');
  });

  it('propagates delivery errors', async () => {
    const service = new MailService(new ConfigService());
    vi.spyOn(service, 'send').mockRejectedValue(new Error('SMTP failed'));

    await expect(service.sendTaskReminder('user@example.com', { id: 'task-id', title: 'Việc' }))
      .rejects.toThrow('SMTP failed');
  });

  it('rejects task links with a non-HTTP frontend URL', async () => {
    const service = new MailService({
      get: () => 'javascript:alert(1)',
    } as ConfigService);

    await expect(service.sendTaskReminder('user@example.com', {
      id: 'task-id',
      title: 'Việc',
    })).rejects.toThrow('FRONTEND_URL must use HTTP or HTTPS');
  });
});
