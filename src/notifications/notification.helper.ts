import type { EntityManager } from 'typeorm';

export enum NotificationType {
  TASK_ROUTED = 'TASK_ROUTED',
  TASK_ACCEPTED = 'TASK_ACCEPTED',
  TASK_DELEGATED = 'TASK_DELEGATED',
  TASK_SUBMITTED = 'TASK_SUBMITTED',
  TASK_APPROVED = 'TASK_APPROVED',
  TASK_REJECTED = 'TASK_REJECTED',
  TASK_COMMENT = 'TASK_COMMENT',
}

export type NotifyInput = {
  actorId: string;
  taskId: string;
  recipientIds: Array<string | null | undefined>;
  title: string;
  content?: string | null;
  type: NotificationType | string;
};

// Tạo thông báo trong cùng transaction/manager; loại trùng và không báo cho chính người thực hiện.
export async function notifyUsers(m: EntityManager, input: NotifyInput): Promise<void> {
  const ids = [...new Set(input.recipientIds.filter((id): id is string => !!id && id !== input.actorId))];
  if (!ids.length) return;
  await m.query(
    `INSERT INTO public.notifications(user_id,task_id,title,content,notification_type,is_read,created_at)
     SELECT u.id,$2,$3,$4,$5,false,NOW() FROM public.users u
     WHERE u.id=ANY($1::uuid[]) AND u.is_active=true`,
    [ids, input.taskId, input.title, input.content ?? null, input.type],
  );
}
