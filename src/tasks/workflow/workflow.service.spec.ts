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
  };

  it('notifies department managers and active LANH_DAO_PHONG users on department routing', async () => {
    const managerRows = [{ user_id: 'mapped-manager-id' }, { user_id: 'department-leader-id' }];
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM public.tasks WHERE')) return [task];
      if (sql.includes('FROM public.task_workflow_routes WHERE')) return [];
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
  });

  it('notifies the selected specialist on direct routing', async () => {
    const assigneeId = 'specialist-id';
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM public.tasks WHERE')) return [task];
      if (sql.includes('FROM public.task_workflow_routes WHERE')) return [];
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
  });
});
