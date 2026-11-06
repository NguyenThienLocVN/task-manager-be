import { DataSource } from 'typeorm';
import { TaskSecurityService, type TaskActor } from './security/task-security.service';
import { TasksService } from './tasks.service';
import { MailService } from '../mail/mail.service';

describe('TasksService', () => {
  const actor: TaskActor = {
    id: 'user-id',
    organizationId: 'organization-id',
    departmentId: 'department-id',
    roles: ['LANH_DAO_PHONG'],
  };
  const createService = (db: DataSource, security: TaskSecurityService) =>
    new TasksService(db, security, {
      sendTaskReminder: vi.fn().mockResolvedValue(undefined),
    } as unknown as MailService);

  it('allows department viewers to read assignments for tasks in their department', async () => {
    const task = {
      id: 'task-id',
      organization_id: actor.organizationId,
      department_id: actor.departmentId,
      created_by: 'another-user',
      assigned_by: 'another-user',
      responsible_user_id: null,
    };
    const managerQuery = vi.fn()
      .mockResolvedValueOnce([task])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const db = {
      manager: { query: managerQuery },
    } as unknown as DataSource;
    const security = {
      hasAnyPermission: vi.fn().mockResolvedValue(false),
      canViewDepartment: vi.fn().mockResolvedValue(true),
    } as unknown as TaskSecurityService;
    const service = createService(db, security);

    await expect(service.get(actor, task.id)).resolves.toEqual({
      ...task,
      resultFiles: [],
    });
    expect(security.canViewDepartment).toHaveBeenCalledWith(actor, task.department_id);
  });

  it('returns result file metadata and a task-scoped download URL', async () => {
    const task = {
      id: 'task-id',
      organization_id: actor.organizationId,
      department_id: actor.departmentId,
      created_by: actor.id,
      assigned_by: actor.id,
      responsible_user_id: null,
    };
    const file = {
      id: 'file-id',
      file_name: 'result.pdf',
      mime_type: 'application/pdf',
      file_size: '1234',
      created_at: new Date('2026-11-03T00:00:00.000Z'),
    };
    const managerQuery = vi.fn()
      .mockResolvedValueOnce([task])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([file]);
    const db = {
      manager: { query: managerQuery },
    } as unknown as DataSource;
    const security = {
      hasAnyPermission: vi.fn().mockResolvedValue(false),
      canViewDepartment: vi.fn().mockResolvedValue(false),
    } as unknown as TaskSecurityService;
    const service = createService(db, security);

    await expect(service.get(actor, task.id)).resolves.toMatchObject({
      resultFiles: [{
        id: file.id,
        fileName: file.file_name,
        mimeType: file.mime_type,
        fileSize: file.file_size,
        downloadUrl: `/api/tasks/${task.id}/result-files/${file.id}/download`,
      }],
    });
  });

  describe('TasksService comment notifications', () => {
    it('includes the comment author name in the notification content', async () => {
      const actor: TaskActor = {
        id: 'commenter-id',
        organizationId: 'organization-id',
        departmentId: 'department-id',
        roles: [],
      };
      const task = {
        id: 'task-id',
        organization_id: actor.organizationId,
        department_id: actor.departmentId,
        created_by: 'recipient-id',
        assigned_by: 'recipient-id',
        responsible_user_id: actor.id,
      };
      const notificationContent = 'Nội dung bình luận';
      const managerQuery = vi.fn(async (sql: string) => {
        if (sql.includes('FROM public.tasks WHERE')) return [task];
        return [];
      });
      const transactionQuery = vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO public.task_comments')) {
          return [{ id: 'comment-id' }];
        }
        if (sql.includes('SELECT full_name FROM public.users')) {
          return [{ full_name: 'Nguyễn Văn A' }];
        }
        return [];
      });
      const db = {
        manager: { query: managerQuery },
        transaction: vi.fn(
          async (callback: (manager: { query: typeof transactionQuery }) => Promise<unknown>) =>
            callback({ query: transactionQuery }),
        ),
      } as unknown as DataSource;
      const security = {
        canViewDepartment: vi.fn().mockResolvedValue(false),
      } as unknown as TaskSecurityService;
      const service = createService(db, security);

      await service.comment(actor, task.id, { content: notificationContent });

      const notificationQuery = transactionQuery.mock.calls.find(([sql]) =>
        sql.includes('INSERT INTO public.notifications'),
      );
      expect(notificationQuery?.[1]?.[3]).toBe(
        `Người bình luận: Nguyễn Văn A\n${notificationContent}`,
      );
    });
  });

  it('filters task lists by documentId in the database query', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 'task-id', document_id: 'document-id' }]);
    const db = { query } as unknown as DataSource;
    const security = {
      hasAnyPermission: vi.fn().mockResolvedValue(false),
      canViewDepartment: vi.fn().mockResolvedValue(false),
    } as unknown as TaskSecurityService;
    const service = createService(db, security);

    await service.list(actor, { documentId: 'document-id' });

    expect(query.mock.calls[0][0]).toContain('t.document_id=$3');
    expect(query.mock.calls[0][1]).toEqual([
      actor.organizationId,
      actor.id,
      'document-id',
    ]);
    expect(query.mock.calls[1][0]).toContain('t.document_id=$3');
  });

  it('includes same-department tasks in the task list for department viewers', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 'task-id' }]);
    const db = { query } as unknown as DataSource;
    const security = {
      hasAnyPermission: vi.fn().mockResolvedValue(false),
      canViewDepartment: vi.fn().mockResolvedValue(true),
    } as unknown as TaskSecurityService;
    const service = createService(db, security);

    await service.list(actor, {});

    expect(query.mock.calls[0][0]).toContain('t.department_id=$3');
    expect(query.mock.calls[0][1]).toEqual([
      actor.organizationId,
      actor.id,
      actor.departmentId,
    ]);
  });

  it('lets TASK_VIEW_ALL users list tasks across organizations', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ total: 10 }])
      .mockResolvedValueOnce([{ id: 'task-id' }]);
    const db = { query } as unknown as DataSource;
    const security = {
      hasAnyPermission: vi.fn().mockResolvedValue(true),
      canViewDepartment: vi.fn(),
    } as unknown as TaskSecurityService;
    const service = createService(db, security);

    await service.list(actor, {});

    expect(query.mock.calls[0][0]).toContain('WHERE TRUE');
    expect(query.mock.calls[0][0]).not.toContain('organization_id=$1');
    expect(query.mock.calls[0][1]).toEqual([]);
    expect(security.canViewDepartment).not.toHaveBeenCalled();
  });

  it('does not restrict TASK_VIEW_ALL users to their own tasks on my-tasks', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ total: 10 }])
      .mockResolvedValueOnce([{ id: 'task-id' }]);
    const db = { query } as unknown as DataSource;
    const security = {
      hasAnyPermission: vi.fn().mockResolvedValue(true),
      canViewDepartment: vi.fn(),
    } as unknown as TaskSecurityService;
    const service = createService(db, security);

    await service.list(actor, {}, true);

    expect(query.mock.calls[0][0]).toContain('WHERE TRUE');
    expect(query.mock.calls[0][0]).not.toContain('responsible_user_id');
    expect(query.mock.calls[0][1]).toEqual([]);
  });

  it('lets TASK_VIEW_ALL users read a task outside their organization', async () => {
    const task = {
      id: 'task-id',
      organization_id: 'another-organization',
      department_id: null,
    };
    const managerQuery = vi.fn()
      .mockResolvedValueOnce([task])
      .mockResolvedValueOnce([]);
    const db = {
      manager: { query: managerQuery },
    } as unknown as DataSource;
    const security = {
      hasAnyPermission: vi.fn().mockResolvedValue(true),
    } as unknown as TaskSecurityService;
    const service = createService(db, security);

    await expect(service.get(actor, task.id)).resolves.toMatchObject(task);
    expect(managerQuery.mock.calls[0][0]).toBe('SELECT * FROM public.tasks WHERE id=$1');
    expect(managerQuery.mock.calls[0][1]).toEqual([task.id]);
  });
});
