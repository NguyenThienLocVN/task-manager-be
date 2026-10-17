import { DataSource } from 'typeorm';
import { TaskSecurityService, type TaskActor } from './security/task-security.service';
import { TasksService } from './tasks.service';

describe('TasksService department visibility', () => {
  const actor: TaskActor = {
    id: 'user-id',
    organizationId: 'organization-id',
    departmentId: 'department-id',
    roles: ['LANH_DAO_PHONG'],
  };

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
      .mockResolvedValueOnce([]);
    const db = {
      manager: { query: managerQuery },
    } as unknown as DataSource;
    const security = {
      canViewDepartment: vi.fn().mockResolvedValue(true),
    } as unknown as TaskSecurityService;
    const service = new TasksService(db, security);

    await expect(service.get(actor, task.id)).resolves.toEqual(task);
    expect(security.canViewDepartment).toHaveBeenCalledWith(actor, task.department_id);
  });

  it('filters task lists by documentId in the database query', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 'task-id', document_id: 'document-id' }]);
    const db = { query } as unknown as DataSource;
    const security = {
      canViewDepartment: vi.fn().mockResolvedValue(false),
    } as unknown as TaskSecurityService;
    const service = new TasksService(db, security);

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
      canViewDepartment: vi.fn().mockResolvedValue(true),
    } as unknown as TaskSecurityService;
    const service = new TasksService(db, security);

    await service.list(actor, {});

    expect(query.mock.calls[0][0]).toContain('t.department_id=$3');
    expect(query.mock.calls[0][1]).toEqual([
      actor.organizationId,
      actor.id,
      actor.departmentId,
    ]);
  });
});
