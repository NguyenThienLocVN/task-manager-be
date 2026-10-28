import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { TaskActor } from '../tasks/security/task-security.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

// Người dùng chỉ được thao tác trên thông báo của chính mình (user_id = actor.id).
@Injectable()
export class NotificationsService {
  constructor(private readonly db: DataSource) {}

  async list(actor: TaskActor, q: QueryNotificationsDto) {
    const where = ['n.user_id=$1'];
    const params: any[] = [actor.id];
    if (q.isRead !== undefined) { params.push(q.isRead); where.push(`n.is_read=$${params.length}`); }
    if (q.notificationType) { params.push(q.notificationType); where.push(`n.notification_type=$${params.length}`); }
    if (q.taskId) { params.push(q.taskId); where.push(`n.task_id=$${params.length}`); }
    const clause = where.join(' AND ');
    const total = await this.db.query(`SELECT count(*)::int AS total FROM public.notifications n WHERE ${clause}`, params);
    const items = await this.db.query(
      `SELECT n.id,n.user_id,n.task_id,n.title,n.content,n.notification_type,n.is_read,n.read_at,n.created_at,
              t.task_code,t.title AS task_title
       FROM public.notifications n LEFT JOIN public.tasks t ON t.id=n.task_id
       WHERE ${clause} ORDER BY n.created_at DESC, n.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    return { items, total: total[0].total, page: q.page, limit: q.limit };
  }

  async unreadCount(actor: TaskActor) {
    const r = await this.db.query('SELECT count(*)::int AS count FROM public.notifications WHERE user_id=$1 AND is_read=false', [actor.id]);
    return { unread: r[0].count };
  }

  async get(actor: TaskActor, id: string) {
    const rows = await this.db.query(
      `SELECT n.*,t.task_code,t.title AS task_title FROM public.notifications n
       LEFT JOIN public.tasks t ON t.id=n.task_id WHERE n.id=$1 AND n.user_id=$2`, [id, actor.id]);
    if (!rows.length) throw new NotFoundException('Notification not found');
    return rows[0];
  }

  async setRead(actor: TaskActor, id: string, read: boolean) {
    const rows = await this.db.query(
      `UPDATE public.notifications SET is_read=$3,read_at=CASE WHEN $3 THEN COALESCE(read_at,NOW()) ELSE NULL END
       WHERE id=$1 AND user_id=$2 RETURNING *`, [id, actor.id, read]);
    if (!rows.length) throw new NotFoundException('Notification not found');
    return rows[0];
  }

  async markAllRead(actor: TaskActor) {
    const rows = await this.db.query(
      'UPDATE public.notifications SET is_read=true,read_at=NOW() WHERE user_id=$1 AND is_read=false RETURNING id', [actor.id]);
    return { updated: rows.length };
  }

  async remove(actor: TaskActor, id: string) {
    const rows = await this.db.query('DELETE FROM public.notifications WHERE id=$1 AND user_id=$2 RETURNING id', [id, actor.id]);
    if (!rows.length) throw new NotFoundException('Notification not found');
    return { deleted: true };
  }

  async removeRead(actor: TaskActor) {
    const rows = await this.db.query('DELETE FROM public.notifications WHERE user_id=$1 AND is_read=true RETURNING id', [actor.id]);
    return { deleted: rows.length };
  }
}
