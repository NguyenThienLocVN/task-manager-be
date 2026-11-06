import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { WorkflowService } from './workflow.service';
import { TaskSecurityService, type TaskActor } from '../security/task-security.service';

describe('WorkflowService department acceptance', () => {
  const actor: TaskActor = {
    id: 'manager-id',
    organizationId: 'organization-id',
    departmentId: 'department-id',
    roles: ['LANH_DAO_PHONG'],
  };
  const taskId = 'task-id';
  const task = {
    id: taskId,
    organization_id: actor.organizationId,
    created_by: 'issuer-id',
    assigned_by: 'issuer-id',
    status: 'ASSIGNED',
    title: 'Văn bản cần xử lý',
  };
  const pendingDepartmentRoute = {
    id: 'route-id',
    route_type: 'DEPARTMENT',
    department_id: actor.departmentId,
    route_status: 'PENDING',
  };

  function createService(roleRows: unknown[], managerRows: unknown[] = []) {
    const manager = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM public.tasks WHERE')) return [task];
        if (sql.includes('SELECT full_name FROM public.users')) {
          return [{ full_name: 'Nguyễn Văn B' }];
        }
        if (sql.includes('FROM public.task_workflow_routes')) {
          return [pendingDepartmentRoute];
        }
        if (sql.includes('FROM public.task_department_managers')) {
          return managerRows;
        }
        if (sql.includes("r.code='LANH_DAO_PHONG'")) return roleRows;
        return [];
      }),
    };
    const db = {
      transaction: vi.fn(
        async (callback: (entityManager: EntityManager) => Promise<unknown>) =>
          callback(manager as unknown as EntityManager),
      ),
    };
    const security = {} as TaskSecurityService;

    return {
      service: new WorkflowService(
        db as unknown as DataSource,
        security,
      ),
      manager,
    };
  }

  it('allows a LANH_DAO_PHONG user to accept a route in their own department', async () => {
    const { service, manager } = createService([{ id: 1 }]);

    await expect(service.accept(actor, taskId)).resolves.toEqual({
      accepted: true,
      routeId: pendingDepartmentRoute.id,
    });
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("r.code='LANH_DAO_PHONG'"),
      [actor.id, actor.departmentId, actor.organizationId],
    );
    const notificationQuery = manager.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO public.notifications'),
    );
    expect(notificationQuery?.[1]?.[3]).toBe(
      'Nguyễn Văn B đã tiếp nhận công việc: Văn bản cần xử lý',
    );
  });

  it('does not allow a department role to accept another department route', async () => {
    const { service, manager } = createService([]);

    await expect(
      service.accept({ ...actor, departmentId: 'another-department' }, taskId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.query).not.toHaveBeenCalledWith(
      expect.stringContaining("r.code='LANH_DAO_PHONG'"),
      expect.anything(),
    );
  });

  it('continues to allow users explicitly mapped as task department managers', async () => {
    const { service, manager } = createService([], [{ id: 1 }]);

    await expect(service.accept(actor, taskId)).resolves.toEqual({
      accepted: true,
      routeId: pendingDepartmentRoute.id,
    });
    expect(manager.query).not.toHaveBeenCalledWith(
      expect.stringContaining("r.code='LANH_DAO_PHONG'"),
      expect.anything(),
    );
  });
});

describe('WorkflowService department route notifications', () => {
  const actor: TaskActor = {
    id: 'issuer-id',
    organizationId: 'organization-id',
    departmentId: 'issuer-department-id',
    roles: ['LANH_DAO_CO_QUAN'],
  };
  const task = {
    id: 'task-id',
    organization_id: actor.organizationId,
    created_by: actor.id,
    assigned_by: actor.id,
    status: 'NEW',
    title: 'Văn bản cần xử lý',
    due_date: '2026-03-15',
  };

  it('notifies department managers and active LANH_DAO_PHONG users on department routing', async () => {
    const managerRows = [{ user_id: 'mapped-manager-id' }, { user_id: 'department-leader-id' }];
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM public.tasks WHERE')) return [task];
      if (sql.includes('FROM public.task_workflow_routes WHERE')) return [];
      if (sql.includes('SELECT full_name FROM public.users')) {
        return [{ full_name: 'Nguyễn Văn A' }];
      }
      if (sql.includes('FROM public.departments WHERE')) return [{ id: 'department-id' }];
      if (sql.includes('INSERT INTO public.task_workflow_routes')) return [{ id: 'route-id' }];
      if (sql.includes('FROM public.task_department_managers dm')) return managerRows;
      return [];
    });
    const db = {
      transaction: vi.fn(async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback({ query } as unknown as EntityManager),
      ),
    };
    const service = new WorkflowService(
      db as unknown as DataSource,
      {} as TaskSecurityService,
    );

    await service.route(actor, task.id, {
      routeType: 'DEPARTMENT',
      departmentId: 'department-id',
    });

    const recipientQuery = query.mock.calls.find(([sql]) =>
      sql.includes('FROM public.task_department_managers dm'),
    );
    expect(recipientQuery?.[0]).toContain("r.code='LANH_DAO_PHONG'");
    expect(recipientQuery?.[1]).toEqual(['department-id', actor.organizationId]);

    const notificationQuery = query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO public.notifications'),
    );
    expect(notificationQuery?.[1]?.[0]).toEqual(
      expect.arrayContaining(['mapped-manager-id', 'department-leader-id']),
    );
    expect(notificationQuery?.[1]?.[3]).toBe(
      'Văn bản cần xử lý\n - Người giao: Nguyễn Văn A\n - Hạn chót: 15/03/2026',
    );
  });

  it('notifies the selected specialist on direct routing', async () => {
    const assigneeId = 'specialist-id';
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM public.tasks WHERE')) return [task];
      if (sql.includes('FROM public.task_workflow_routes WHERE')) return [];
      if (sql.includes('SELECT full_name FROM public.users')) {
        return [{ full_name: 'Nguyễn Văn A' }];
      }
      if (sql.includes('FROM public.departments WHERE')) return [{ id: 'department-id' }];
      if (sql.includes('FROM public.users WHERE id=$1')) return [{ id: assigneeId }];
      if (sql.includes('INSERT INTO public.task_workflow_routes')) return [{ id: 'route-id' }];
      return [];
    });
    const db = {
      transaction: vi.fn(async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback({ query } as unknown as EntityManager),
      ),
    };
    const service = new WorkflowService(
      db as unknown as DataSource,
      {} as TaskSecurityService,
    );

    await service.route(actor, task.id, {
      routeType: 'DIRECT',
      departmentId: 'department-id',
      assigneeId,
    });

    const notificationQuery = query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO public.notifications'),
    );
    expect(notificationQuery?.[1]?.[0]).toEqual([assigneeId]);
    expect(notificationQuery?.[1]?.[3]).toBe(
      'Văn bản cần xử lý\n - Người giao: Nguyễn Văn A\n - Hạn chót: 15/03/2026',
    );
  });
});

describe('WorkflowService submission notifications', () => {
  it('includes the submitter name before the task title', async () => {
    const actor: TaskActor = {
      id: 'specialist-id',
      organizationId: 'organization-id',
      departmentId: 'department-id',
      roles: [],
    };
    const task = {
      id: 'task-id',
      organization_id: actor.organizationId,
      created_by: 'issuer-id',
      assigned_by: 'issuer-id',
      responsible_user_id: actor.id,
      status: 'IN_PROGRESS',
      title: 'Văn bản cần xử lý',
    };
    const route = { route_status: 'ACCEPTED' };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM public.tasks WHERE')) return [task];
      if (sql.includes('FROM public.task_workflow_routes')) return [route];
      if (sql.includes('SELECT full_name FROM public.users')) {
        return [{ full_name: 'Nguyễn Văn C' }];
      }
      return [];
    });
    const db = {
      transaction: vi.fn(async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback({ query } as unknown as EntityManager),
      ),
    };
    const service = new WorkflowService(
      db as unknown as DataSource,
      {} as TaskSecurityService,
    );

    await service.submit(actor, task.id, {});

    const notificationQuery = query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO public.notifications'),
    );
    expect(notificationQuery?.[1]?.[3]).toBe(
      'Nguyễn Văn C trình gửi kết quả công việc: Văn bản cần xử lý',
    );
  });
});

describe('WorkflowService review history', () => {
  it.each([
    ['APPROVE', 'COMPLETED'],
    ['REJECT', 'IN_PROGRESS'],
  ] as const)('records %s as the history action', async (decision, expectedStatus) => {
    const actor: TaskActor = {
      id: 'reviewer-id',
      organizationId: 'organization-id',
      departmentId: 'department-id',
      roles: [],
    };
    const task = {
      id: 'task-id',
      organization_id: actor.organizationId,
      created_by: actor.id,
      assigned_by: actor.id,
      responsible_user_id: 'specialist-id',
      department_id: null,
      status: 'PENDING_REVIEW',
      title: 'Văn bản cần xử lý',
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM public.tasks WHERE')) return [task];
      return [];
    });
    const db = {
      transaction: vi.fn(async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback({ query } as unknown as EntityManager),
      ),
    };
    const service = new WorkflowService(
      db as unknown as DataSource,
      {} as TaskSecurityService,
    );

    await expect(service.review(actor, task.id, { decision, comment: 'Nhận xét' })).resolves.toEqual({
      status: expectedStatus,
      decision,
    });

    const historyQuery = query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO public.task_history'),
    );
    expect(historyQuery?.[1]).toEqual([
      task.id,
      decision,
      actor.id,
      JSON.stringify(task.status),
      JSON.stringify(`${expectedStatus}: Nhận xét`),
    ]);
  });
});
